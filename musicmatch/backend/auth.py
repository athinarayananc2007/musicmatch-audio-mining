"""
MusicMatch - JWT Authentication Module
=======================================
Provides user registration, login, and token verification using PyJWT.
Passwords are hashed with bcrypt via werkzeug.security.
"""

import os
import datetime
import jwt
from functools import wraps
from flask import request, jsonify
from database import create_user, get_user_by_username, get_user_by_id
from werkzeug.security import generate_password_hash, check_password_hash

# ─── Config ───────────────────────────────────────────────────────────────────

JWT_SECRET = os.environ.get("JWT_SECRET", "musicmatch-super-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24


# ─── Token helpers ────────────────────────────────────────────────────────────

def _create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def jwt_required(f):
    """
    Decorator: Protect a Flask route with JWT Bearer token authentication.
    Injects `current_user` dict into the wrapped function as a keyword argument.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"status": "error", "error": "Missing or invalid Authorization header."}), 401

        token = auth_header.split(" ", 1)[1].strip()
        payload = _decode_token(token)
        if not payload:
            return jsonify({"status": "error", "error": "Token is expired or invalid. Please log in again."}), 401

        user = get_user_by_id(int(payload["sub"]))
        if not user:
            return jsonify({"status": "error", "error": "User account not found."}), 401

        kwargs["current_user"] = user
        return f(*args, **kwargs)
    return decorated


def get_optional_user() -> dict | None:
    """Extract user dict if valid Bearer token provided, otherwise return None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    payload = _decode_token(token)
    if not payload or "sub" not in payload:
        return None
    try:
        return get_user_by_id(int(payload["sub"]))
    except (TypeError, ValueError):
        return None



# ─── Auth route handlers ──────────────────────────────────────────────────────

def handle_register():
    """
    POST /api/auth/register
    Body: { "username": str, "email": str, "password": str }
    """
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    email    = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()

    if not username or len(username) < 3:
        return jsonify({"status": "error", "error": "Username must be at least 3 characters."}), 400
    if not email or "@" not in email:
        return jsonify({"status": "error", "error": "A valid email address is required."}), 400
    if not password or len(password) < 6:
        return jsonify({"status": "error", "error": "Password must be at least 6 characters."}), 400

    pw_hash = generate_password_hash(password)
    user_id = create_user(username, email, pw_hash)
    if user_id is None:
        return jsonify({"status": "error", "error": "Username or email is already registered."}), 409

    token = _create_token(user_id, username)
    return jsonify({
        "status": "success",
        "message": f"Welcome to MusicMatch, {username}!",
        "token": token,
        "user": {"id": user_id, "username": username, "email": email}
    }), 201


def handle_login():
    """
    POST /api/auth/login
    Body: { "username": str, "password": str }
    """
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    if not username or not password:
        return jsonify({"status": "error", "error": "Username and password are required."}), 400

    user = get_user_by_username(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"status": "error", "error": "Invalid username or password."}), 401

    token = _create_token(user["id"], user["username"])
    return jsonify({
        "status": "success",
        "message": f"Welcome back, {username}!",
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }), 200


def handle_me():
    """
    GET /api/auth/me  — Returns profile of the authenticated user.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"status": "error", "error": "Not authenticated."}), 401
    token = auth_header.split(" ", 1)[1].strip()
    payload = _decode_token(token)
    if not payload:
        return jsonify({"status": "error", "error": "Token expired or invalid."}), 401
    try:
        user = get_user_by_id(int(payload["sub"]))
    except (TypeError, ValueError):
        return jsonify({"status": "error", "error": "Invalid token subject."}), 401
    if not user:
        return jsonify({"status": "error", "error": "User not found."}), 404
    return jsonify({"status": "success", "user": user}), 200
