"""Credential encryption tests (PBKDF2-SHA256 + AES-256-GCM)."""
import pytest
from cryptography.exceptions import InvalidTag

from app.core.encryption import CredentialEncryption

APP_KEY = "test-encryption-key"


def test_encrypt_password_roundtrip():
    encryption = CredentialEncryption(APP_KEY)

    ciphertext, salt = encryption.encrypt_password("database-secret")

    assert isinstance(ciphertext, bytes)
    assert isinstance(salt, bytes)
    assert len(salt) == 16
    assert len(ciphertext) == 12 + len("database-secret") + 16
    assert encryption.decrypt_password(ciphertext, salt) == "database-secret"


def test_encrypt_password_uses_unique_salt_and_ciphertext():
    encryption = CredentialEncryption(APP_KEY)

    first_ciphertext, first_salt = encryption.encrypt_password("database-secret")
    second_ciphertext, second_salt = encryption.encrypt_password("database-secret")

    assert first_salt != second_salt
    assert first_ciphertext != second_ciphertext


def test_decrypt_password_rejects_tampered_ciphertext():
    encryption = CredentialEncryption(APP_KEY)
    ciphertext, salt = encryption.encrypt_password("database-secret")
    tampered = bytes([ciphertext[0] ^ 1]) + ciphertext[1:]

    with pytest.raises(InvalidTag):
        encryption.decrypt_password(tampered, salt)


def test_decrypt_password_rejects_wrong_key():
    ciphertext, salt = CredentialEncryption(APP_KEY).encrypt_password("database-secret")

    with pytest.raises(InvalidTag):
        CredentialEncryption("different-key").decrypt_password(ciphertext, salt)
