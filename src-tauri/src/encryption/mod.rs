use keyring::Entry;

pub struct EncryptionService {
    service_name: String,
}

impl EncryptionService {
    pub fn new(service: &str) -> Self {
        Self {
            service_name: service.to_string(),
        }
    }

    pub async fn encrypt_and_store(&self, account: &str, plaintext: &str) -> Result<(), String> {
        let entry = Entry::new(&self.service_name, account)
            .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
        
        entry.set_password(plaintext)
            .map_err(|e| format!("Failed to store password in keychain: {}", e))?;
        
        Ok(())
    }

    pub async fn retrieve_and_decrypt(&self, account: &str) -> Result<String, String> {
        let entry = Entry::new(&self.service_name, account)
            .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
        
        entry.get_password()
            .map_err(|e| format!("Failed to retrieve password from keychain: {}", e))
    }

    pub async fn delete_credential(&self, account: &str) -> Result<(), String> {
        let entry = Entry::new(&self.service_name, account)
            .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
        
        entry.delete_password()
            .map_err(|e| format!("Failed to delete credential from keychain: {}", e))
    }

    pub async fn has_credential(&self, account: &str) -> bool {
        let entry = match Entry::new(&self.service_name, account) {
            Ok(e) => e,
            Err(_) => return false,
        };
        
        entry.get_password().is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_encrypt_and_retrieve() {
        let service = EncryptionService::new("com.vibeshell.test");
        let account = "test-account";
        let plaintext = "test-password";

        match service.encrypt_and_store(account, plaintext).await {
            Ok(()) => {}
            Err(err) if err.contains("Platform secure storage failure") || err.contains("Operation not permitted") => return,
            Err(err) => panic!("{}", err),
        }

        let retrieved = service.retrieve_and_decrypt(account).await.unwrap();
        assert_eq!(retrieved, plaintext);

        service.delete_credential(account).await.unwrap();
    }

    #[tokio::test]
    async fn test_delete_credential() {
        let service = EncryptionService::new("com.vibeshell.test");
        let account = "test-delete";
        let plaintext = "test-password";

        match service.encrypt_and_store(account, plaintext).await {
            Ok(()) => {}
            Err(err) if err.contains("Platform secure storage failure") || err.contains("Operation not permitted") => return,
            Err(err) => panic!("{}", err),
        }

        assert!(service.has_credential(account).await);

        service.delete_credential(account).await.unwrap();
        assert!(!service.has_credential(account).await);
    }
}
