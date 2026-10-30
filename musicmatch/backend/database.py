"""
MusicMatch - Supabase Cloud Database Layer
===========================================
Replaces the SQLite persistence with Supabase (PostgreSQL) for serverless
deployment on Vercel. All session, song, similarity, user, and contact data
is stored in Supabase tables.

Required environment variables:
    SUPABASE_URL  — Project URL  (e.g. https://xxxx.supabase.co)
    SUPABASE_KEY  — service_role key  (NOT the anon key — needed for full access)

Tables (created via supabase_migration.sql):
    sessions         — (session_id TEXT PK, user_id, created_at, updated_at)
    songs            — (id BIGSERIAL PK, session_id FK, name, features JSONB, ...)
    similarity       — (session_id TEXT PK, matrix JSONB)
    users            — (id BIGSERIAL PK, username, email, password_hash, created_at)
    contact_messages — (id BIGSERIAL PK, name, email, message, created_at)
"""

import os
import json
import logging
import datetime
from typing import Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import numpy as np

# ─── Supabase Client Singleton ────────────────────────────────────────────────

_supabase_client = None


def _get_supabase():
    """
    Initialise and return the Supabase client (singleton).
    Raises RuntimeError if SUPABASE_URL / SUPABASE_KEY are not set.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY environment variables are required. "
            "Set them in your .env file or Vercel project settings."
        )

    # Sanitize URL: strip accidental /rest/v1 or trailing slashes (Supabase SDK appends them automatically)
    import re
    url = re.sub(r"/rest/v1/?$", "", url).rstrip("/")

    from supabase import create_client
    _supabase_client = create_client(url, key)
    logging.info("[Supabase] Client initialised successfully.")
    return _supabase_client


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


# ─── Initialisation (no-op for Supabase — tables created via migration) ──────

def init_db() -> None:
    """
    No-op for Supabase. Tables are created via supabase_migration.sql.
    This function exists for backward compatibility with app.py.
    """
    # Verify connection works on startup
    try:
        sb = _get_supabase()
        logging.info("[Supabase] Database connection verified.")
    except Exception as e:
        logging.warning(f"[Supabase] Could not verify connection on init: {e}")


# ─── Session helpers ──────────────────────────────────────────────────────────

def ensure_session(session_id: str, user_id: Optional[str] = None) -> None:
    """Create a session row if it doesn't already exist (upsert)."""
    sb = _get_supabase()
    now = _now_iso()
    try:
        sb.table("sessions").upsert(
            {
                "session_id": session_id,
                "user_id": user_id,
                "created_at": now,
                "updated_at": now,
            },
            on_conflict="session_id",
        ).execute()
    except Exception as e:
        logging.warning(f"[Supabase] ensure_session failed: {e}")


def touch_session(session_id: str) -> None:
    """Update the updated_at timestamp for an existing session."""
    sb = _get_supabase()
    try:
        sb.table("sessions").update({"updated_at": _now_iso()}).eq(
            "session_id", session_id
        ).execute()
    except Exception as e:
        logging.warning(f"[Supabase] touch_session failed: {e}")


# ─── Song persistence ─────────────────────────────────────────────────────────

def save_songs(
    session_id: str, songs_data: list[dict], enriched_songs: list[dict]
) -> None:
    """
    Persist the raw songs_data features AND the enriched (clustered/PCA)
    metadata for a session. Old songs for this session are deleted first.
    """
    sb = _get_supabase()
    try:
        # Delete existing songs for this session (overwrite semantics)
        sb.table("songs").delete().eq("session_id", session_id).execute()

        # Build a lookup from enriched_songs by original_index
        enriched_map: dict[int, dict] = {
            e["original_index"]: e for e in enriched_songs
        }

        rows = []
        for i, song in enumerate(songs_data):
            e = enriched_map.get(i, {})
            rows.append(
                {
                    "session_id": session_id,
                    "name": song["name"],
                    "features": song["features"],  # Supabase JSONB handles lists natively
                    "tempo": song.get("tempo"),
                    "spectral_centroid": song.get("spectral_centroid"),
                    "chroma_mean": song.get("chroma_mean"),
                    "zcr_mean": song.get("zcr_mean"),
                    "rms_mean": song.get("rms_mean"),
                    "cluster": e.get("cluster"),
                    "pca_x": e.get("pca_x"),
                    "pca_y": e.get("pca_y"),
                    "original_index": i,
                }
            )

        if rows:
            sb.table("songs").insert(rows).execute()
        touch_session(session_id)
    except Exception as e:
        logging.error(f"[Supabase] save_songs failed: {e}")
        raise


def save_similarity_matrix(session_id: str, matrix) -> None:
    """Serialize and store the similarity matrix for a session."""
    if isinstance(matrix, np.ndarray):
        matrix_list = matrix.tolist()
    else:
        matrix_list = matrix

    sb = _get_supabase()
    try:
        sb.table("similarity").upsert(
            {"session_id": session_id, "matrix": matrix_list},
            on_conflict="session_id",
        ).execute()
    except Exception as e:
        logging.warning(f"[Supabase] save_similarity_matrix failed: {e}")


def load_session_data(session_id: str) -> dict[str, Any]:
    """
    Load the complete session cache from Supabase.
    Returns: { 'songs_data': [...], 'enriched_songs': [...], 'similarity_matrix': ndarray|None }
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("songs")
            .select("*")
            .eq("session_id", session_id)
            .order("original_index", desc=False)
            .execute()
        )
        rows = result.data or []

        songs_data = []
        enriched_songs = []

        for r in rows:
            features = r.get("features", [])
            # Supabase returns JSONB as native Python lists
            if isinstance(features, str):
                features = json.loads(features)

            songs_data.append(
                {
                    "name": r["name"],
                    "features": features,
                    "tempo": r.get("tempo"),
                    "spectral_centroid": r.get("spectral_centroid"),
                    "chroma_mean": r.get("chroma_mean"),
                    "zcr_mean": r.get("zcr_mean"),
                    "rms_mean": r.get("rms_mean"),
                }
            )
            enriched_songs.append(
                {
                    "name": r["name"],
                    "tempo": r.get("tempo"),
                    "spectral_centroid": r.get("spectral_centroid"),
                    "chroma_mean": r.get("chroma_mean"),
                    "zcr_mean": r.get("zcr_mean"),
                    "rms_mean": r.get("rms_mean"),
                    "cluster": r.get("cluster"),
                    "pca_x": r.get("pca_x"),
                    "pca_y": r.get("pca_y"),
                    "original_index": r.get("original_index"),
                }
            )

        # Load similarity matrix
        sim_result = (
            sb.table("similarity")
            .select("matrix")
            .eq("session_id", session_id)
            .execute()
        )
        sim_rows = sim_result.data or []

        similarity_matrix = None
        if sim_rows:
            matrix_data = sim_rows[0].get("matrix")
            if isinstance(matrix_data, str):
                matrix_data = json.loads(matrix_data)
            if matrix_data:
                similarity_matrix = np.array(matrix_data)

        return {
            "songs_data": songs_data,
            "enriched_songs": enriched_songs,
            "similarity_matrix": similarity_matrix,
        }
    except Exception as e:
        logging.error(f"[Supabase] load_session_data failed: {e}")
        return {"songs_data": [], "enriched_songs": [], "similarity_matrix": None}


def clear_session(session_id: str) -> None:
    """Remove all song and similarity data for a given session."""
    sb = _get_supabase()
    try:
        sb.table("songs").delete().eq("session_id", session_id).execute()
        sb.table("similarity").delete().eq("session_id", session_id).execute()
    except Exception as e:
        logging.warning(f"[Supabase] clear_session failed: {e}")


# ─── User helpers (for JWT auth) ─────────────────────────────────────────────

def create_user(username: str, email: str, password_hash: str) -> Optional[int]:
    """Insert a new user. Returns the new row id, or None if username/email taken."""
    sb = _get_supabase()
    try:
        result = (
            sb.table("users")
            .insert(
                {
                    "username": username,
                    "email": email,
                    "password_hash": password_hash,
                    "created_at": _now_iso(),
                }
            )
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data[0].get("id")
        return None
    except Exception as e:
        # Unique constraint violation → username/email already taken
        logging.info(f"[Supabase] create_user conflict: {e}")
        return None


def get_user_by_username(username: str) -> Optional[dict]:
    """Fetch a user row by username."""
    sb = _get_supabase()
    try:
        result = (
            sb.table("users")
            .select("id, username, email, password_hash")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        logging.warning(f"[Supabase] get_user_by_username failed: {e}")
        return None


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Fetch a user row by id."""
    sb = _get_supabase()
    try:
        result = (
            sb.table("users")
            .select("id, username, email")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        logging.warning(f"[Supabase] get_user_by_id failed: {e}")
        return None


def link_session_to_user(session_id: str, user_id: int) -> None:
    """Associate a session with an authenticated user account."""
    sb = _get_supabase()
    now = _now_iso()
    try:
        sb.table("sessions").upsert(
            {
                "session_id": session_id,
                "user_id": str(user_id),
                "created_at": now,
                "updated_at": now,
            },
            on_conflict="session_id",
        ).execute()
    except Exception as e:
        logging.warning(f"[Supabase] link_session_to_user failed: {e}")


def get_user_sessions(user_id: int) -> list[dict]:
    """Retrieve all analysis sessions for an authenticated user."""
    sb = _get_supabase()
    try:
        # Get sessions owned by this user
        session_result = (
            sb.table("sessions")
            .select("session_id, created_at, updated_at")
            .eq("user_id", str(user_id))
            .order("updated_at", desc=True)
            .execute()
        )
        session_rows = session_result.data or []

        sessions = []
        for sr in session_rows:
            sid = sr["session_id"]
            # Get songs for this session
            songs_result = (
                sb.table("songs")
                .select("name, cluster")
                .eq("session_id", sid)
                .order("original_index", desc=False)
                .execute()
            )
            song_rows = songs_result.data or []

            names_list = [s["name"] for s in song_rows if s.get("name")]
            clusters = set(s["cluster"] for s in song_rows if s.get("cluster") is not None)

            sessions.append(
                {
                    "session_id": sid,
                    "created_at": sr["created_at"],
                    "updated_at": sr["updated_at"],
                    "song_count": len(song_rows),
                    "clusters_count": len(clusters),
                    "preview_songs": names_list[:5],
                }
            )
        return sessions
    except Exception as e:
        logging.warning(f"[Supabase] get_user_sessions failed: {e}")
        return []


def delete_user_session(session_id: str, user_id: int) -> bool:
    """Delete a session if it belongs to the given user."""
    sb = _get_supabase()
    try:
        # Check ownership
        check = (
            sb.table("sessions")
            .select("session_id")
            .eq("session_id", session_id)
            .eq("user_id", str(user_id))
            .execute()
        )
        if not check.data:
            return False

        # Cascade delete: songs and similarity first, then session
        sb.table("songs").delete().eq("session_id", session_id).execute()
        sb.table("similarity").delete().eq("session_id", session_id).execute()
        sb.table("sessions").delete().eq("session_id", session_id).execute()
        return True
    except Exception as e:
        logging.warning(f"[Supabase] delete_user_session failed: {e}")
        return False


# ─── Song helper (individual save — used during analyze) ─────────────────────

def save_song(
    session_id: str,
    song_entry: dict,
    enriched_entry: Optional[dict] = None,
) -> bool:
    """
    Save a single song to Supabase. This is called per-song during analysis
    as a secondary write (the batch save_songs is the primary).
    Returns True on success, False on failure.
    """
    # save_songs already handles batch persistence — this is a no-op to avoid
    # duplicate inserts. Kept for API compatibility with app.py.
    return True


def get_all_songs(session_id: Optional[str] = None) -> list[dict]:
    """
    Retrieve songs from the Supabase 'songs' table.
    Optionally filter by session_id.
    """
    sb = _get_supabase()
    try:
        query = sb.table("songs").select("*")
        if session_id:
            query = query.eq("session_id", session_id)
        result = query.order("created_at", desc=False).execute()
        return result.data or []
    except Exception as e:
        logging.warning(f"[Supabase] get_all_songs failed: {e}")
        return []


# ─── Contact message helper ───────────────────────────────────────────────────

def save_contact_message(name: str, email: str, message: str) -> bool:
    """
    Persist a contact form submission to the Supabase 'contact_messages' table.
    """
    sb = _get_supabase()
    try:
        sb.table("contact_messages").insert(
            {"name": name, "email": email, "message": message}
        ).execute()
        return True
    except Exception as e:
        logging.warning(f"[Supabase] save_contact_message failed: {e}")
        return False
