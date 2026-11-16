"""Password hashing and JWT creation/decoding helpers."""
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import get_settings
from app.models import User

InvalidTokenError = jwt.InvalidTokenError

_REQUIRED_CLAIMS = ("sub", "email", "roles", "type", "iat", "exp")
_TOKEN_TYPES = ("access", "refresh")


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Password cannot exceed 72 bytes")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Return whether a plaintext password matches a bcrypt hash."""
    try:
        plain_bytes = plain_password.encode("utf-8")
        hash_bytes = password_hash.encode("utf-8")
        if len(plain_bytes) > 72:
            return False
        return bcrypt.checkpw(plain_bytes, hash_bytes)
    except (TypeError, ValueError):
        return False


def create_access_token(user: User, roles: Sequence[str] | None = None) -> str:
    """Create a short-lived access token for a user."""
    settings = get_settings()
    expires_delta = timedelta(minutes=settings.jwt_expire_minutes)
    return _create_token(user, "access", expires_delta, roles)


def create_refresh_token(user: User, roles: Sequence[str] | None = None) -> str:
    """Create a long-lived refresh token for a user."""
    settings = get_settings()
    expires_delta = timedelta(days=settings.refresh_token_expire_days)
    return _create_token(user, "refresh", expires_delta, roles)


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """Decode and validate a JWT, optionally requiring a specific token type."""
    if expected_type is not None and expected_type not in _TOKEN_TYPES:
        raise ValueError(f"Unsupported token type: {expected_type}")

    settings = get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": list(_REQUIRED_CLAIMS)},
        )
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError(str(exc)) from exc

    token_type = claims.get("type")
    if token_type not in _TOKEN_TYPES:
        raise InvalidTokenError("Invalid token type")
    if expected_type is not None and token_type != expected_type:
        raise InvalidTokenError(
            f"Expected a {expected_type} token, received {token_type}"
        )
    if not isinstance(claims.get("roles"), list):
        raise InvalidTokenError("Invalid roles claim")
    return claims


def _create_token(
    user: User,
    token_type: str,
    expires_delta: timedelta,
    roles: Sequence[str] | None,
) -> str:
    settings = get_settings()
    issued_at = datetime.now(UTC)
    token_roles = list(roles) if roles is not None else list(getattr(user, "roles", []))
    claims = {
        "sub": str(user.id),
        "email": user.email,
        "roles": token_roles,
        "type": token_type,
        "iat": issued_at,
        "exp": issued_at + expires_delta,
    }
    return jwt.encode(
        claims,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
