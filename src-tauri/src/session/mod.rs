use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::encryption::EncryptionService;
use crate::storage::StorageService;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    #[serde(skip)]
    pub password: Option<String>,
    #[serde(skip)]
    pub private_key: Option<String>,
    pub created_at: i64,
    pub last_used: i64,
}

pub struct SessionManager {
    storage: Arc<StorageService>,
    encryption: Arc<EncryptionService>,
}

impl SessionManager {
    pub fn new(storage: Arc<StorageService>, encryption: Arc<EncryptionService>) -> Self {
        Self { storage, encryption }
    }

    pub async fn save_connection(&self, mut config: ConnectionConfig) -> Result<(), String> {
        // Generate ID if not present
        if config.id.is_empty() {
            config.id = Uuid::new_v4().to_string();
        }

        // Set created_at if not set
        if config.created_at == 0 {
            config.created_at = chrono::Utc::now().timestamp();
        }

        // Store password in keychain if present
        if let Some(password) = &config.password {
            self.encryption
                .encrypt_and_store(&config.id, password)
                .await?;
        }

        // Store private key in keychain if present
        if let Some(private_key) = &config.private_key {
            let key_account = format!("{}_key", config.id);
            self.encryption
                .encrypt_and_store(&key_account, private_key)
                .await?;
        }

        // Load existing connections
        let mut connections = self.load_connections_internal().await.unwrap_or_default();

        // Update or add
        if let Some(pos) = connections.iter().position(|c| c.id == config.id) {
            connections[pos] = config.clone();
        } else {
            connections.push(config);
        }

        // Save to disk
        let servers_path = self.storage.get_servers_path();
        self.storage.write_json(&servers_path, &connections).await?;

        Ok(())
    }

    pub async fn load_connections(&self) -> Result<Vec<ConnectionConfig>, String> {
        let mut connections = self.load_connections_internal().await?;

        // Load passwords from keychain
        for conn in &mut connections {
            if self.encryption.has_credential(&conn.id).await {
                conn.password = self.encryption.retrieve_and_decrypt(&conn.id).await.ok();
            }

            let key_account = format!("{}_key", conn.id);
            if self.encryption.has_credential(&key_account).await {
                conn.private_key = self.encryption.retrieve_and_decrypt(&key_account).await.ok();
            }
        }

        // Sort alphabetically by name
        connections.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(connections)
    }

    async fn load_connections_internal(&self) -> Result<Vec<ConnectionConfig>, String> {
        let servers_path = self.storage.get_servers_path();
        if !servers_path.exists() {
            return Ok(Vec::new());
        }

        self.storage.read_json(&servers_path).await
    }

    pub async fn update_connection(&self, id: &str, config: ConnectionConfig) -> Result<(), String> {
        let mut connections = self.load_connections_internal().await?;

        let pos = connections
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| format!("Connection not found: {}", id))?;

        connections[pos] = config.clone();

        // Update password in keychain if present
        if let Some(password) = &config.password {
            self.encryption.encrypt_and_store(id, password).await?;
        }

        // Update private key in keychain if present
        if let Some(private_key) = &config.private_key {
            let key_account = format!("{}_key", id);
            self.encryption
                .encrypt_and_store(&key_account, private_key)
                .await?;
        }

        let servers_path = self.storage.get_servers_path();
        self.storage.write_json(&servers_path, &connections).await?;

        Ok(())
    }

    pub async fn delete_connection(&self, id: &str) -> Result<(), String> {
        let mut connections = self.load_connections_internal().await?;

        connections.retain(|c| c.id != id);

        // Delete from keychain
        let _ = self.encryption.delete_credential(id).await;
        let key_account = format!("{}_key", id);
        let _ = self.encryption.delete_credential(&key_account).await;

        // Delete associated history
        let history_path = self.storage.get_history_path(id);
        if history_path.exists() {
            let _ = self.storage.delete_file(&history_path).await;
        }

        let servers_path = self.storage.get_servers_path();
        self.storage.write_json(&servers_path, &connections).await?;

        Ok(())
    }

    pub async fn get_connection(&self, id: &str) -> Result<ConnectionConfig, String> {
        let connections = self.load_connections().await?;
        connections
            .into_iter()
            .find(|c| c.id == id)
            .ok_or_else(|| format!("Connection not found: {}", id))
    }

    pub async fn update_last_used(&self, id: &str) -> Result<(), String> {
        let mut connections = self.load_connections_internal().await?;

        let pos = connections
            .iter()
            .position(|c| c.id == id)
            .ok_or_else(|| format!("Connection not found: {}", id))?;

        connections[pos].last_used = chrono::Utc::now().timestamp();

        let servers_path = self.storage.get_servers_path();
        self.storage.write_json(&servers_path, &connections).await?;

        Ok(())
    }
}
