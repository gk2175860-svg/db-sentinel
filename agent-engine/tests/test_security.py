"""Security core tests: bcrypt password helpers and JWT access/refresh tokens."""
import uuid

import jwt
import pytest

from app.core.security import (
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import User


def test_hash_password_roundtrip():
    password_hash = hash_password("correct horse battery staple")

    assert password_hash.startswith("$2b$")
    assert verify_password("correct horse battery staple", password_hash)
    assert not verify_password("wrong password", password_hash)


def test_verify_password_rejects_malformed_hash():
    assert not verify_password("password", "not-a-bcrypt-hash")


def test_access_token_contains_required_claims():
    user = User(id=uuid.uuid4(), email="admin@example.com")

    token = create_access_token(user)
    claims = decode_token(token, expected_type="access")

    assert claims["sub"] == str(user.id)
    assert claims["email"] == user.email
    assert claims["roles"] == []
    assert claims["type"] == "access"
    assert claims["exp"] - claims["iat"] == 60 * 60


def test_refresh_token_has_refresh_type_and_longer_expiration():
    user = User(id=uuid.uuid4(), email="admin@example.com")

    token = create_refresh_token(user)
    claims = decode_token(token, expected_type="refresh")

    assert claims["type"] == "refresh"
    assert claims["exp"] - claims["iat"] == 7 * 24 * 60 * 60


def test_decode_token_rejects_wrong_token_type():
    user = User(id=uuid.uuid4(), email="admin@example.com")
    refresh_token = create_refresh_token(user)

    with pytest.raises(InvalidTokenError):
        decode_token(refresh_token, expected_type="access")


def test_decode_token_rejects_invalid_signature():
    token = create_access_token(User(id=uuid.uuid4(), email="admin@example.com"))
    invalid_token = token[:-1] + ("a" if token[-1] != "a" else "b")

    with pytest.raises(InvalidTokenError):
        decode_token(invalid_token)


def test_pyjwt_invalid_token_error_is_the_public_error_type():
    assert issubclass(InvalidTokenError, jwt.InvalidTokenError)
