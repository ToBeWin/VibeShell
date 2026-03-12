use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tokio::fs as async_fs;
use uuid::Uuid;

pub struct StorageService {
    base_path: PathBuf,
}

impl StorageService {
    pub fn new() -> Result<Self, String> {
        let base_path = dirs::config_dir()
            .ok_or("Could not determine config directory")?
            .join("vibeshell");
        
        // Ensure base directory exists
        fs::create_dir_all(&base_path)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        
        // Ensure history subdirectory exists
        let history_path = base_path.join("history");
        fs::create_dir_all(&history_path)
            .map_err(|e| format!("Failed to create history directory: {}", e))?;
        
        Ok(Self { base_path })
    }

    pub async fn write_json<T: Serialize>(&self, path: &Path, data: &T) -> Result<(), String> {
        let json = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize data: {}", e))?;

        if let Some(parent) = path.parent() {
            async_fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
        
        // Atomic write: write to temp file, then rename
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or("Failed to derive file name for temp file")?;
        let temp_path = path.with_file_name(format!("{file_name}.{}.tmp", Uuid::new_v4()));
        async_fs::write(&temp_path, json)
            .await
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        
        async_fs::rename(&temp_path, path)
            .await
            .map_err(|e| format!("Failed to rename temp file: {}", e))?;
        
        Ok(())
    }

    pub async fn read_json<T: for<'de> Deserialize<'de>>(&self, path: &Path) -> Result<T, String> {
        let content = async_fs::read_to_string(path)
            .await
            .map_err(|e| format!("Failed to read file: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))
    }

    pub async fn delete_file(&self, path: &Path) -> Result<(), String> {
        async_fs::remove_file(path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))
    }

    pub async fn ensure_directory(&self, path: &Path) -> Result<(), String> {
        async_fs::create_dir_all(path)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))
    }

    pub fn get_data_version(&self) -> Result<u32, String> {
        let version_path = self.base_path.join("data_version.txt");
        if !version_path.exists() {
            return Ok(1); // Default version
        }
        
        let content = fs::read_to_string(&version_path)
            .map_err(|e| format!("Failed to read version file: {}", e))?;
        
        content.trim().parse::<u32>()
            .map_err(|e| format!("Failed to parse version: {}", e))
    }

    pub fn set_data_version(&self, version: u32) -> Result<(), String> {
        let version_path = self.base_path.join("data_version.txt");
        fs::write(&version_path, version.to_string())
            .map_err(|e| format!("Failed to write version file: {}", e))
    }

    pub fn get_servers_path(&self) -> PathBuf {
        self.base_path.join("servers.json")
    }

    pub fn get_history_path(&self, server_id: &str) -> PathBuf {
        self.base_path.join("history").join(format!("{}.json", server_id))
    }

    pub fn get_groups_path(&self) -> PathBuf {
        self.base_path.join("groups.json")
    }

    pub fn get_workspace_path(&self) -> PathBuf {
        self.base_path.join("workspace.json")
    }

    pub fn get_base_path(&self) -> &Path {
        &self.base_path
    }
}

#[cfg(test)]
mod tests {
    use super::StorageService;
    use serde::Serialize;
    use uuid::Uuid;

    #[derive(Serialize)]
    struct TestPayload {
        value: &'static str,
    }

    #[tokio::test]
    async fn write_json_creates_parent_directories_and_replaces_target() {
        let temp_root = std::env::temp_dir().join(format!("vibeshell-storage-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&temp_root).expect("temp root");

        let storage = StorageService {
            base_path: temp_root.clone(),
        };
        let target = temp_root.join("nested").join("workspace.json");

        storage
            .write_json(&target, &TestPayload { value: "first" })
            .await
            .expect("first write");
        storage
            .write_json(&target, &TestPayload { value: "second" })
            .await
            .expect("second write");

        let saved = tokio::fs::read_to_string(&target).await.expect("read target");
        assert!(saved.contains("second"));

        std::fs::remove_dir_all(temp_root).expect("cleanup");
    }
}
