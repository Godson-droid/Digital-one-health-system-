from cryptography.fernet import Fernet
import os

# Get encryption key from environment
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())

try:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    print(f"Warning: Invalid encryption key, generating new one: {e}")
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_data(data: str) -> str:
    """Encrypt sensitive data using AES 256"""
    try:
        if not data:
            return ""
        return cipher_suite.encrypt(data.encode()).decode()
    except Exception as e:
        print(f"Error encrypting data: {e}")
        return data  # Return original data if encryption fails

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data"""
    try:
        if not encrypted_data:
            return ""
        return cipher_suite.decrypt(encrypted_data.encode()).decode()
    except Exception as e:
        print(f"Error decrypting data: {e}")
        return "Decryption failed"  # Return error message if decryption fails