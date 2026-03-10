use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::storage::StorageService;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerGroup {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub collapsed: bool,
    pub order: i32,
    pub server_ids: Vec<String>,
    pub created_at: i64,
}

impl ServerGroup {
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            icon: None,
            collapsed: false,
            order: 0,
            server_ids: Vec::new(),
            created_at: chrono::Utc::now().timestamp(),
        }
    }
}

pub struct GroupManager {
    storage: Arc<StorageService>,
}

impl GroupManager {
    pub fn new(storage: Arc<StorageService>) -> Self {
        Self { storage }
    }

    pub async fn save_group(&self, group: ServerGroup) -> Result<(), String> {
        let mut groups = self.load_groups().await.unwrap_or_default();
        
        if let Some(pos) = groups.iter().position(|g| g.id == group.id) {
            groups[pos] = group;
        } else {
            groups.push(group);
        }
        
        // Sort by order
        groups.sort_by_key(|g| g.order);
        
        let groups_path = self.storage.get_groups_path();
        self.storage.write_json(&groups_path, &groups).await
    }

    pub async fn load_groups(&self) -> Result<Vec<ServerGroup>, String> {
        let groups_path = self.storage.get_groups_path();
        if !groups_path.exists() {
            // Create default groups
            let default_groups = vec![
                ServerGroup {
                    id: "favorites".to_string(),
                    name: "Favorites".to_string(),
                    icon: Some("⭐".to_string()),
                    collapsed: false,
                    order: 0,
                    server_ids: Vec::new(),
                    created_at: chrono::Utc::now().timestamp(),
                },
                ServerGroup {
                    id: "production".to_string(),
                    name: "Production".to_string(),
                    icon: Some("🚀".to_string()),
                    collapsed: false,
                    order: 1,
                    server_ids: Vec::new(),
                    created_at: chrono::Utc::now().timestamp(),
                },
                ServerGroup {
                    id: "development".to_string(),
                    name: "Development".to_string(),
                    icon: Some("🔧".to_string()),
                    collapsed: false,
                    order: 2,
                    server_ids: Vec::new(),
                    created_at: chrono::Utc::now().timestamp(),
                },
            ];
            self.storage.write_json(&groups_path, &default_groups).await?;
            return Ok(default_groups);
        }

        let mut groups: Vec<ServerGroup> = self.storage.read_json(&groups_path).await?;
        groups.sort_by_key(|g| g.order);
        Ok(groups)
    }

    pub async fn delete_group(&self, id: &str) -> Result<(), String> {
        let mut groups = self.load_groups().await?;
        groups.retain(|g| g.id != id);
        
        let groups_path = self.storage.get_groups_path();
        self.storage.write_json(&groups_path, &groups).await
    }

    pub async fn add_server_to_group(&self, group_id: &str, server_id: &str) -> Result<(), String> {
        let mut groups = self.load_groups().await?;
        
        // Remove server from all groups first
        for group in &mut groups {
            group.server_ids.retain(|id| id != server_id);
        }
        
        // Add to target group
        if let Some(group) = groups.iter_mut().find(|g| g.id == group_id) {
            if !group.server_ids.contains(&server_id.to_string()) {
                group.server_ids.push(server_id.to_string());
            }
        }
        
        let groups_path = self.storage.get_groups_path();
        self.storage.write_json(&groups_path, &groups).await
    }

    pub async fn remove_server_from_group(&self, group_id: &str, server_id: &str) -> Result<(), String> {
        let mut groups = self.load_groups().await?;
        
        if let Some(group) = groups.iter_mut().find(|g| g.id == group_id) {
            group.server_ids.retain(|id| id != server_id);
        }
        
        let groups_path = self.storage.get_groups_path();
        self.storage.write_json(&groups_path, &groups).await
    }

    pub async fn toggle_group_collapsed(&self, id: &str) -> Result<(), String> {
        let mut groups = self.load_groups().await?;
        
        if let Some(group) = groups.iter_mut().find(|g| g.id == id) {
            group.collapsed = !group.collapsed;
        }
        
        let groups_path = self.storage.get_groups_path();
        self.storage.write_json(&groups_path, &groups).await
    }

    pub async fn reorder_groups(&self, group_ids: Vec<String>) -> Result<(), String> {
        let mut groups = self.load_groups().await?;
        
        for (index, group_id) in group_ids.iter().enumerate() {
            if let Some(group) = groups.iter_mut().find(|g| &g.id == group_id) {
                group.order = index as i32;
            }
        }
        
        groups.sort_by_key(|g| g.order);
        
        let groups_path = self.storage.get_groups_path();
        self.storage.write_json(&groups_path, &groups).await
    }
}
