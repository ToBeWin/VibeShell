use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::storage::StorageService;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceSession {
    pub server_id: String,
    pub pane_ids: Vec<String>,
    pub active_pane_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceState {
    pub sessions: Vec<WorkspaceSession>,
    pub active_session_id: Option<String>,
    pub last_saved: i64,
}

pub struct WorkspaceManager {
    storage: Arc<StorageService>,
}

impl WorkspaceManager {
    pub fn new(storage: Arc<StorageService>) -> Self {
        Self { storage }
    }

    pub async fn save_workspace(&self, state: WorkspaceState) -> Result<(), String> {
        let workspace_path = self.storage.get_workspace_path();
        self.storage.write_json(&workspace_path, &state).await
    }

    pub async fn load_workspace(&self) -> Result<Option<WorkspaceState>, String> {
        let workspace_path = self.storage.get_workspace_path();
        if !workspace_path.exists() {
            return Ok(None);
        }

        match self.storage.read_json::<WorkspaceState>(&workspace_path).await {
            Ok(state) => Ok(Some(state)),
            Err(_) => Ok(None), // Return None for corrupted data
        }
    }

    pub async fn clear_workspace(&self) -> Result<(), String> {
        let workspace_path = self.storage.get_workspace_path();
        if workspace_path.exists() {
            self.storage.delete_file(&workspace_path).await?;
        }
        Ok(())
    }
}
