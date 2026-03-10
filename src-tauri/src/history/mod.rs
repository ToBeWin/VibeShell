use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::storage::StorageService;

const MAX_HISTORY_SIZE: usize = 10000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HistoryEntry {
    pub command: String,
    pub timestamp: i64,
}

pub struct HistoryBuffer {
    pub entries: VecDeque<HistoryEntry>,
    pub dirty: bool,
    pub last_write: i64,
}

impl HistoryBuffer {
    pub fn new() -> Self {
        Self {
            entries: VecDeque::new(),
            dirty: false,
            last_write: 0,
        }
    }

    pub fn append(&mut self, command: String) {
        let timestamp = chrono::Utc::now().timestamp();
        self.entries.push_back(HistoryEntry { command, timestamp });
        
        // Enforce size limit
        while self.entries.len() > MAX_HISTORY_SIZE {
            self.entries.pop_front();
        }
        
        self.dirty = true;
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.dirty = true;
    }
}

pub struct HistoryManager {
    storage: Arc<StorageService>,
    buffers: Arc<Mutex<HashMap<String, HistoryBuffer>>>,
}

impl HistoryManager {
    pub fn new(storage: Arc<StorageService>) -> Self {
        Self {
            storage,
            buffers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn append_command(&self, server_id: &str, command: String) -> Result<(), String> {
        let mut buffers = self.buffers.lock().await;
        let buffer = buffers.entry(server_id.to_string()).or_insert_with(HistoryBuffer::new);
        buffer.append(command);
        Ok(())
    }

    pub async fn load_history(&self, server_id: &str) -> Result<Vec<HistoryEntry>, String> {
        // Check if already in memory
        {
            let buffers = self.buffers.lock().await;
            if let Some(buffer) = buffers.get(server_id) {
                return Ok(buffer.entries.iter().cloned().collect());
            }
        }

        // Load from disk
        let history_path = self.storage.get_history_path(server_id);
        if !history_path.exists() {
            return Ok(Vec::new());
        }

        let entries: Vec<HistoryEntry> = self.storage.read_json(&history_path).await?;
        
        // Cache in memory
        let mut buffers = self.buffers.lock().await;
        let mut buffer = HistoryBuffer::new();
        buffer.entries = entries.iter().cloned().collect();
        buffer.dirty = false;
        buffers.insert(server_id.to_string(), buffer);

        Ok(entries)
    }

    pub async fn search_history(&self, server_id: &str, query: &str) -> Result<Vec<HistoryEntry>, String> {
        let entries = self.load_history(server_id).await?;
        let query_lower = query.to_lowercase();
        
        Ok(entries
            .into_iter()
            .filter(|entry| entry.command.to_lowercase().contains(&query_lower))
            .collect())
    }

    pub async fn clear_history(&self, server_id: &str) -> Result<(), String> {
        // Clear in-memory buffer
        {
            let mut buffers = self.buffers.lock().await;
            if let Some(buffer) = buffers.get_mut(server_id) {
                buffer.clear();
            }
        }

        // Delete file
        let history_path = self.storage.get_history_path(server_id);
        if history_path.exists() {
            self.storage.delete_file(&history_path).await?;
        }

        Ok(())
    }

    pub async fn flush_all(&self) -> Result<(), String> {
        let mut buffers = self.buffers.lock().await;
        let current_time = chrono::Utc::now().timestamp();

        for (server_id, buffer) in buffers.iter_mut() {
            if buffer.dirty && (current_time - buffer.last_write >= 1) {
                let history_path = self.storage.get_history_path(server_id);
                let entries: Vec<HistoryEntry> = buffer.entries.iter().cloned().collect();
                self.storage.write_json(&history_path, &entries).await?;
                buffer.dirty = false;
                buffer.last_write = current_time;
            }
        }

        Ok(())
    }
}
