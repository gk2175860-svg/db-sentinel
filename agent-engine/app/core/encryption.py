"""Authenticated encryption for managed database credentials."""
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_SALT_BYTES = 16
_KEY_BYTES = 32
_NONCE_BYTES = 12
_PBKDF2_ITERATIONS = 100_000


class CredentialEncryption:
    """Encrypt credentials with PBKDF2-derived AES-256-GCM keys."""

    def __init__(self, app_key: str):
        self.app_key = app_key.encode("utf-8")

    def encrypt_password(self, plaintext: str) -> tuple[bytes, bytes]:
        """Encrypt a password and return ciphertext plus its derivation salt."""
        salt = os.urandom(_SALT_BYTES)
        key = self._derive_key(salt)
        nonce = os.urandom(_NONCE_BYTES)
        encrypted = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
        return nonce + encrypted, salt

    def decrypt_password(self, ciphertext: bytes, salt: bytes) -> str:
        """Decrypt and authenticate a password encrypted by this service."""
        if len(salt) != _SALT_BYTES:
            raise ValueError("Salt must be exactly 16 bytes")
        key = self._derive_key(salt)
        nonce = ciphertext[:_NONCE_BYTES]
        if len(nonce) != _NONCE_BYTES:
            raise ValueError("Ciphertext is missing the GCM nonce")
        plaintext = AESGCM(key).decrypt(nonce, ciphertext[_NONCE_BYTES:], None)
        return plaintext.decode("utf-8")

    def _derive_key(self, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=_KEY_BYTES,
            salt=salt,
            iterations=_PBKDF2_ITERATIONS,
        )
        return kdf.derive(self.app_key)
