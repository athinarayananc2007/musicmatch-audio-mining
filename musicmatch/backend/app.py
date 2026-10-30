"""
MusicMatch - Flask API Server  (v2 — Cloud Edition)
====================================================
Deployed as a Vercel Python serverless function.
  ✅ Supabase persistence        (database.py)
  ✅ JWT user authentication      (auth.py)
  ✅ 18-D acoustic features       (audio_features.py)
  ✅ Auto-K (Elbow + Silhouette)  (recommender.py :: find_optimal_k)
  ✅ New endpoint: GET /api/optimal-clusters

Universal Audio Ingestion:
- Full support for MPEG (.mpeg, .mpg, .mp2, .mpga), WhatsApp Audio, MP3, WAV,
  M4A, AAC, OPUS, OGG, WebM, FLAC, AMR, and extensionless audio streams.
"""

import os
import re
import json
import tempfile
import uuid
import datetime
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS

from audio_features import extract_features
from recommender import process_songs_data, get_recommendations_for_song, find_optimal_k
from spotify_client import recommend_spotify_tracks, verify_spotify_credentials
from database import (
    init_db, ensure_session, save_songs, save_similarity_matrix,
    load_session_data, clear_session,
    save_song, get_all_songs, save_contact_message,
    link_session_to_user, get_user_sessions, delete_user_session
)
from auth import handle_register, handle_login, handle_me, jwt_required, get_optional_user

# ─── App Setup ────────────────────────────────────────────────────────────────

app = Flask(__name__)

# Allow configurable CORS origins for cloud deployment (Netlify ↔ Vercel)
_cors_origins = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_origins == "*":
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)
elif _cors_origins:
    _allowed_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]
    CORS(app, resources={r"/*": {"origins": _allowed_origins}}, supports_credentials=True)
else:
    _allowed_origins = [
        re.compile(r"^https:\/\/.*\.netlify\.app$"),
        re.compile(r"^https:\/\/.*\.vercel\.app$"),
        "http://localhost:8000", "http://127.0.0.1:8000",
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5000", "http://127.0.0.1:5000",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ]
    CORS(app, resources={r"/*": {"origins": _allowed_origins}}, supports_credentials=True)

# Use /tmp on serverless platforms (Vercel/Lambda) where the filesystem is read-only
_is_serverless = os.environ.get("VERCEL", "") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "")
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER  = os.path.join(tempfile.gettempdir(), "musicmatch_uploads") if _is_serverless else os.path.join(BASE_DIR, "uploads")

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".mpeg", ".mpg", ".mp2", ".mpga",
    ".m4a", ".aac", ".opus", ".ogg", ".webm", ".flac",
    ".amr", ".wma", ".oga", ".weba", ".caf"
}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB

app.config["UPLOAD_FOLDER"]   = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialise the database connection (Supabase — tables created via migration)
init_db()

SESSION_COOKIE = "mm_session"


# ─── Session helpers ─────────────────────────────────────────────────────────

def _get_or_create_session_id() -> str:
    """Read session cookie or mint a new UUID."""
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        sid = uuid.uuid4().hex
    ensure_session(sid)
    return sid


def _set_session_cookie(response, session_id: str):
    response.set_cookie(
        SESSION_COOKIE, session_id,
        max_age=60 * 60 * 24 * 7,   # 7 days
        httponly=True, samesite="Lax"
    )
    return response


# ─── File helpers ─────────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    if not filename:
        return False
    _, ext = os.path.splitext(filename.lower())
    return (not ext) or (ext in ALLOWED_EXTENSIONS)


def _extract_single_audio_file(file, upload_folder: str):
    orig_filename = file.filename.strip()
    if not allowed_file(orig_filename):
        return None, {"name": orig_filename, "reason": "Unsupported format."}, None

    _, ext = os.path.splitext(orig_filename.lower())
    safe_ext  = ext if ext else ".mpeg"
    unique_name = f"{uuid.uuid4().hex}{safe_ext}"
    temp_path   = os.path.join(upload_folder, unique_name)
    file.save(temp_path)

    try:
        features = extract_features(temp_path, duration=30.0)
        # features: [mfcc×13, tempo, centroid, chroma, zcr, rms]
        song_entry = {
            "name":              orig_filename,
            "features":          features,
            "tempo":             features[13],
            "spectral_centroid": features[14],
            "chroma_mean":       features[15],
            "zcr_mean":          features[16],
            "rms_mean":          features[17],
        }
        return song_entry, None, temp_path
    except Exception as e:
        return None, {"name": orig_filename, "reason": f"Acoustic decoding error: {str(e)}"}, temp_path


def _process_uploaded_audio_files(uploaded_files, upload_folder: str):
    valid_songs_data, skipped_files, temp_saved_paths = [], [], []
    for file in uploaded_files:
        if not file or not file.filename:
            continue
        song, skipped, temp_path = _extract_single_audio_file(file, upload_folder)
        if temp_path:
            temp_saved_paths.append(temp_path)
        if song:
            valid_songs_data.append(song)
        elif skipped:
            skipped_files.append(skipped)
    return valid_songs_data, skipped_files, temp_saved_paths


def _prepare_enriched_songs(valid_songs_data: list, requested_clusters: int):
    if len(valid_songs_data) >= 3:
        enriched_songs, _, similarity_matrix = process_songs_data(
            valid_songs_data, requested_clusters=requested_clusters
        )
        return enriched_songs, similarity_matrix

    enriched_songs = [
        {
            "name":              song["name"],
            "tempo":             round(float(song.get("tempo", 0.0)), 1),
            "spectral_centroid": round(float(song.get("spectral_centroid", 0.0)), 1),
            "chroma_mean":       round(float(song.get("chroma_mean", 0.0)), 4),
            "zcr_mean":          round(float(song.get("zcr_mean", 0.0)), 6),
            "rms_mean":          round(float(song.get("rms_mean", 0.0)), 6),
            "cluster":           idx,
            "pca_x":             0.0 if idx == 0 else 1.0,
            "pca_y":             0.0 if idx == 0 else -1.0,
            "original_index":    idx
        }
        for idx, song in enumerate(valid_songs_data)
    ]
    return enriched_songs, None


def _cleanup_temp_files(paths: list[str]) -> None:
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


def _parse_clusters_param(raw) -> int:
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 3


# ─── Error Handlers ───────────────────────────────────────────────────────────

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"status": "error", "error": "Total audio payload exceeds the 50 MB upload limit."}), 413


@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({"status": "error", "error": "An internal server error occurred while processing audio."}), 500


# ─── Health & Root ────────────────────────────────────────────────────────────
 
@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    spotify_configured = bool(
        os.environ.get("SPOTIFY_CLIENT_ID") and os.environ.get("SPOTIFY_CLIENT_SECRET")
    )
    return jsonify({
        "status": "ok",
        "app": "MusicMatch Audio Mining API v2 (Cloud Edition)",
        "features": "18-D (13 MFCCs + Tempo + Centroid + Chroma + ZCR + RMS)",
        "auth": "JWT enabled",
        "persistence": "Supabase PostgreSQL",
        "runtime": "Vercel Python Serverless",
        "spotify_configured": spotify_configured,
        "supported_formats": sorted(ALLOWED_EXTENSIONS)
    }), 200


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    return handle_register()


@app.route("/api/auth/login", methods=["POST"])
def login():
    return handle_login()


@app.route("/api/auth/me", methods=["GET"])
def me():
    return handle_me()


@app.route("/api/auth/link-session", methods=["POST"])
@jwt_required
def link_current_session(current_user):
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id") or request.cookies.get(SESSION_COOKIE)
    if not session_id:
        return jsonify({"status": "error", "error": "No session provided."}), 400
    link_session_to_user(session_id, current_user["id"])
    return jsonify({"status": "success", "message": "Session linked to account."}), 200


@app.route("/api/user/sessions", methods=["GET"])
@jwt_required
def list_user_sessions(current_user):
    sessions = get_user_sessions(current_user["id"])
    return jsonify({"status": "success", "sessions": sessions}), 200


@app.route("/api/user/sessions/<session_id>", methods=["GET"])
@jwt_required
def get_user_session_detail(current_user, session_id):
    cache = load_session_data(session_id)
    enriched_songs = cache.get("enriched_songs", [])
    if not enriched_songs:
        return jsonify({"status": "error", "error": "Session data not found."}), 404
    
    formatted_songs = [
        {
            "name":              s["name"],
            "tempo":             s["tempo"],
            "spectral_centroid": s["spectral_centroid"],
            "chroma_mean":       s.get("chroma_mean", 0.0),
            "zcr_mean":          s.get("zcr_mean", 0.0),
            "rms_mean":          s.get("rms_mean", 0.0),
            "cluster":           s["cluster"],
            "pca_x":             s["pca_x"],
            "pca_y":             s["pca_y"],
        }
        for s in enriched_songs
    ]
    return jsonify({
        "status": "success",
        "session_id": session_id,
        "clusters_count": len({s["cluster"] for s in enriched_songs}),
        "total_analyzed": len(enriched_songs),
        "feature_dim": 18,
        "songs": formatted_songs
    }), 200


@app.route("/api/user/sessions/<session_id>/restore", methods=["POST"])
@jwt_required
def restore_user_session(current_user, session_id):
    cache = load_session_data(session_id)
    enriched_songs = cache.get("enriched_songs", [])
    if not enriched_songs:
        return jsonify({"status": "error", "error": "Session data not found or empty."}), 404
    
    formatted_songs = [
        {
            "name":              s["name"],
            "tempo":             s["tempo"],
            "spectral_centroid": s["spectral_centroid"],
            "chroma_mean":       s.get("chroma_mean", 0.0),
            "zcr_mean":          s.get("zcr_mean", 0.0),
            "rms_mean":          s.get("rms_mean", 0.0),
            "cluster":           s["cluster"],
            "pca_x":             s["pca_x"],
            "pca_y":             s["pca_y"],
        }
        for s in enriched_songs
    ]
    resp = make_response(jsonify({
        "status":         "success",
        "session_id":     session_id,
        "clusters_count": len({s["cluster"] for s in enriched_songs}),
        "total_analyzed": len(enriched_songs),
        "feature_dim":    18,
        "songs":          formatted_songs,
        "restored":       True
    }), 200)
    _set_session_cookie(resp, session_id)
    return resp


@app.route("/api/user/sessions/<session_id>", methods=["DELETE"])
@jwt_required
def delete_session(current_user, session_id):
    deleted = delete_user_session(session_id, current_user["id"])
    if not deleted:
        return jsonify({"status": "error", "error": "Session not found or not owned by you."}), 404
    return jsonify({"status": "success", "message": "Session deleted."}), 200


# ─── Analyze ──────────────────────────────────────────────────────────────────

@app.route("/api/analyze", methods=["POST"])
def analyze_songs():
    """
    POST /api/analyze
    Accepts:
        - files: list of user audio files
        - clusters: int  (default 3)
    Returns:
        JSON with song name, 18 acoustic features, cluster, PCA coords.
    Session is persisted to SQLite and returned as a cookie.
    """
    session_id = _get_or_create_session_id()

    uploaded_files = request.files.getlist("files") or request.files.getlist("audio_files")
    if not uploaded_files:
        return jsonify({"status": "error", "error": "No audio files uploaded."}), 400

    requested_clusters = _parse_clusters_param(request.form.get("clusters", 3))
    valid_songs, skipped, temp_paths = _process_uploaded_audio_files(
        uploaded_files, app.config["UPLOAD_FOLDER"]
    )

    try:
        if not valid_songs:
            return jsonify({
                "status": "error",
                "error": "No valid audio could be decoded from the provided files.",
                "skipped": skipped
            }), 400

        enriched_songs, similarity_matrix = _prepare_enriched_songs(valid_songs, requested_clusters)

        # ── Supabase persistence ──
        save_songs(session_id, valid_songs, enriched_songs)
        if similarity_matrix is not None:
            save_similarity_matrix(session_id, similarity_matrix)

        # ── Link to authenticated user if logged in ──
        current_user = get_optional_user()
        if current_user:
            link_session_to_user(session_id, current_user["id"])

        # (Batch save_songs above already persisted all data to Supabase)

        formatted_songs = [
            {
                "name":              s["name"],
                "tempo":             s["tempo"],
                "spectral_centroid": s["spectral_centroid"],
                "chroma_mean":       s.get("chroma_mean", 0.0),
                "zcr_mean":          s.get("zcr_mean", 0.0),
                "rms_mean":          s.get("rms_mean", 0.0),
                "cluster":           s["cluster"],
                "pca_x":             s["pca_x"],
                "pca_y":             s["pca_y"],
            }
            for s in enriched_songs
        ]

        resp = make_response(jsonify({
            "status":         "success",
            "session_id":     session_id,
            "clusters_count": len({s["cluster"] for s in enriched_songs}),
            "total_analyzed": len(enriched_songs),
            "feature_dim":    18,
            "songs":          formatted_songs,
            "skipped":        skipped
        }), 200)
        _set_session_cookie(resp, session_id)
        return resp

    finally:
        _cleanup_temp_files(temp_paths)


# ─── Optimal Clusters ─────────────────────────────────────────────────────────

@app.route("/api/optimal-clusters", methods=["GET"])
def optimal_clusters():
    """
    GET /api/optimal-clusters
    Uses the current session's scaled features to compute the Elbow curve
    and Silhouette scores for K = 2 … 10, then suggests the best K.
    """
    import numpy as np
    from sklearn.preprocessing import StandardScaler

    session_id = request.cookies.get(SESSION_COOKIE)
    if not session_id:
        return jsonify({"status": "error", "error": "No active session. Analyze some audio first."}), 400

    cache = load_session_data(session_id)
    songs_data = cache.get("songs_data", [])

    if len(songs_data) < 3:
        return jsonify({"status": "error", "error": "Need at least 3 analyzed songs."}), 400

    import numpy as np
    raw_features    = np.array([s["features"] for s in songs_data], dtype=float)
    scaled_features = StandardScaler().fit_transform(raw_features)

    result = find_optimal_k(scaled_features, max_k=min(10, len(songs_data) - 1))

    return jsonify({
        "status":    "success",
        "session_id": session_id,
        "n_songs":   len(songs_data),
        **result
    }), 200


# ─── Intra-catalog recommend ──────────────────────────────────────────────────

@app.route("/api/recommend", methods=["POST"])
def recommend_songs():
    import numpy as np

    session_id = request.cookies.get(SESSION_COOKIE)
    data = request.form if request.form else (request.get_json(silent=True) or {})
    song_name = data.get("song")

    try:
        count = max(1, min(5, int(data.get("count", 3))))
    except (TypeError, ValueError):
        count = 3

    if not song_name:
        return jsonify({"status": "error", "error": "A 'song' name parameter is required."}), 400

    # Load from SQLite if session cookie present; otherwise return error
    if session_id:
        cache = load_session_data(session_id)
    else:
        return jsonify({"status": "error", "error": "No active session found. Analyze audio first."}), 400

    enriched_songs    = cache.get("enriched_songs", [])
    similarity_matrix = cache.get("similarity_matrix")

    if not enriched_songs:
        return jsonify({"status": "error", "error": "No analyzed audio found in session."}), 400

    target = next((s for s in enriched_songs if s["name"].lower() == song_name.lower()), enriched_songs[0])

    recommendations = []
    if similarity_matrix is not None and len(enriched_songs) >= 3:
        try:
            recommendations = get_recommendations_for_song(
                target_song_name=target["name"],
                enriched_songs=enriched_songs,
                similarity_matrix=similarity_matrix,
                top_k=count
            )
        except Exception:
            recommendations = []

    return jsonify({
        "status": "success",
        "target_song": {
            "name":              target["name"],
            "cluster":           target["cluster"],
            "tempo":             target["tempo"],
            "spectral_centroid": target["spectral_centroid"],
        },
        "recommendations_count": len(recommendations),
        "recommendations":       recommendations
    }), 200


# ─── Spotify ──────────────────────────────────────────────────────────────────

@app.route("/api/spotify/recommend", methods=["POST"])
def spotify_recommend():
    data = request.get_json(silent=True) or request.form.to_dict()
    try:
        tempo = float(data.get("tempo", 120.0))
    except (TypeError, ValueError):
        tempo = 120.0
    try:
        spectral_centroid = float(data.get("spectral_centroid", 1800.0))
    except (TypeError, ValueError):
        spectral_centroid = 1800.0

    genre         = data.get("genre", "pop")
    limit         = int(data.get("limit", 6))
    client_id     = data.get("spotify_client_id")
    client_secret = data.get("spotify_client_secret")

    result = recommend_spotify_tracks(
        tempo=tempo, spectral_centroid=spectral_centroid,
        genre=genre, limit=limit,
        client_id=client_id, client_secret=client_secret
    )
    return jsonify(result), 200


@app.route("/api/spotify/verify", methods=["POST"])
def spotify_verify():
    data          = request.get_json(silent=True) or request.form.to_dict()
    client_id     = str(data.get("client_id", "")).strip() or os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = str(data.get("client_secret", "")).strip() or os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        return jsonify({
            "status": "error",
            "error": "Both Spotify Client ID and Client Secret are required. Set them in backend/.env or enter them in the UI."
        }), 400
    result = verify_spotify_credentials(client_id, client_secret)
    return jsonify(result), 200 if result["status"] == "valid" else 401


# ─── Contact ──────────────────────────────────────────────────────────────────

@app.route("/api/contact", methods=["POST"])
def handle_contact():
    data    = request.get_json(silent=True) or request.form.to_dict()
    name    = str(data.get("name",    "")).strip()
    email   = str(data.get("email",   "")).strip()
    message = str(data.get("message", "")).strip()

    if not name:    return jsonify({"status": "error", "error": "Name is required."}), 400
    if not email:   return jsonify({"status": "error", "error": "Email is required."}), 400
    if not message: return jsonify({"status": "error", "error": "Message is required."}), 400

    email_regex = r"^[\w\.\+-]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)+$"
    if not re.match(email_regex, email):
        return jsonify({"status": "error", "error": "Please provide a valid email address."}), 400

    # Save to Supabase (primary and only storage on serverless)
    success = save_contact_message(name, email, message)
    if not success:
        return jsonify({"status": "error", "error": "Failed to save message. Please try again later."}), 500

    return jsonify({"status": "success", "message": "Thank you! Your message has been received."}), 200


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Starting MusicMatch v2 — Audio Mining + Spotify + JWT + Supabase")
    print("Server: http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
