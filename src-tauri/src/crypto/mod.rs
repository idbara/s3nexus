// Crypto module - AES-GCM encryption for credentials
// Agent: implement encrypt() and decrypt() using ring

use crate::error::AppError;
use ring::aead;
use ring::rand::{SecureRandom, SystemRandom};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

const KEY_LEN: usize = 32; // AES-256

pub struct CryptoManager {
    key: aead::LessSafeKey,
}

impl CryptoManager {
    pub fn new(master_key: &[u8; KEY_LEN]) -> Self {
        let unbound_key = aead::UnboundKey::new(&aead::AES_256_GCM, master_key)
            .expect("Failed to create encryption key");
        CryptoManager {
            key: aead::LessSafeKey::new(unbound_key),
        }
    }

    pub fn generate_master_key() -> [u8; KEY_LEN] {
        let rng = SystemRandom::new();
        let mut key = [0u8; KEY_LEN];
        rng.fill(&mut key).expect("Failed to generate random key");
        key
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<Vec<u8>, AppError> {
        let rng = SystemRandom::new();
        let mut nonce_bytes = [0u8; 12];
        rng.fill(&mut nonce_bytes)
            .map_err(|e| AppError::Encryption(format!("Failed to generate nonce: {}", e)))?;

        let nonce = aead::Nonce::assume_unique_for_key(nonce_bytes);
        let mut in_out = plaintext.as_bytes().to_vec();

        self.key
            .seal_in_place_append_tag(nonce, aead::Aad::empty(), &mut in_out)
            .map_err(|e| AppError::Encryption(format!("Encryption failed: {}", e)))?;

        // Prepend nonce to ciphertext
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&in_out);
        Ok(result)
    }

    pub fn decrypt(&self, ciphertext: &[u8]) -> Result<String, AppError> {
        if ciphertext.len() < 12 {
            return Err(AppError::Encryption("Ciphertext too short".into()));
        }

        let (nonce_bytes, encrypted) = ciphertext.split_at(12);
        let nonce = aead::Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|e| AppError::Encryption(format!("Invalid nonce: {}", e)))?;

        let mut in_out = encrypted.to_vec();
        let decrypted = self
            .key
            .open_in_place(nonce, aead::Aad::empty(), &mut in_out)
            .map_err(|e| AppError::Encryption(format!("Decryption failed: {}", e)))?;

        String::from_utf8(decrypted.to_vec())
            .map_err(|e| AppError::Encryption(format!("Invalid UTF-8: {}", e)))
    }

    pub fn master_key_to_string(key: &[u8; KEY_LEN]) -> String {
        BASE64.encode(key)
    }

    pub fn master_key_from_string(s: &str) -> Result<[u8; KEY_LEN], AppError> {
        let bytes = BASE64
            .decode(s)
            .map_err(|e| AppError::Encryption(format!("Invalid base64: {}", e)))?;
        bytes
            .try_into()
            .map_err(|_| AppError::Encryption("Invalid key length".into()))
    }
}
