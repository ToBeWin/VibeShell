use keyring::Entry;
use russh_keys::PublicKeyBase64;
use russh_keys::key::PublicKey;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    // Note: Passwords or keys are stored in the OS keyring.
}

pub struct SecureStorage;

#[derive(Debug, Serialize, Clone)]
pub struct HostKeyRecord {
    pub host: String,
    pub algorithm: String,
    pub fingerprint: String,
    pub key_base64: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct HostKeyScanResult {
    pub trusted: bool,
    pub fingerprint_changed: bool,
    pub record: HostKeyRecord,
}

impl SecureStorage {
    fn vibe_dir() -> Result<PathBuf, String> {
        let config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
        let vibe_dir = config_dir.join("vibeshell");
        if !vibe_dir.exists() {
            fs::create_dir_all(&vibe_dir).map_err(|e| e.to_string())?;
        }
        Ok(vibe_dir)
    }

    pub fn save_password(server_id: &str, password: &str) -> Result<(), String> {
        let entry = Entry::new("com.vibeshell.dev", server_id)
            .map_err(|e| format!("Keyring error: {}", e))?;
        entry.set_password(password)
            .map_err(|e| format!("Failed to set password: {}", e))
    }

    pub fn get_password(server_id: &str) -> Result<String, String> {
        let entry = Entry::new("com.vibeshell.dev", server_id)
            .map_err(|e| format!("Keyring error: {}", e))?;
        entry.get_password()
            .map_err(|e| format!("Failed to get password: {}", e))
    }

    pub fn save_servers(servers: &Vec<ServerConfig>) -> Result<(), String> {
        let config_path = Self::vibe_dir()?.join("servers.json");
        let json = serde_json::to_string_pretty(servers).map_err(|e| e.to_string())?;
        fs::write(config_path, json).map_err(|e| e.to_string())?;
        Ok(())
    }
    
    pub fn load_servers() -> Result<Vec<ServerConfig>, String> {
        let config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
        let config_path = config_dir.join("vibeshell").join("servers.json");
        if !config_path.exists() {
            return Ok(vec![]);
        }
        let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        let servers = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(servers)
    }

    pub fn verify_or_learn_host_key(host: &str, port: u16, public_key: &PublicKey) -> Result<bool, String> {
        let known_hosts_path = Self::vibe_dir()?.join("known_hosts");
        match russh_keys::check_known_hosts_path(host, port, public_key, &known_hosts_path) {
            Ok(true) => Ok(true),
            Ok(false) => {
                russh_keys::learn_known_hosts_path(host, port, public_key, &known_hosts_path)
                    .map_err(|e| format!("Failed to persist host key: {}", e))?;
                Ok(true)
            }
            Err(e) => Err(format!("Host key verification failed: {}", e)),
        }
    }

    pub fn host_key_scan_result(host: &str, port: u16, public_key: &PublicKey) -> Result<HostKeyScanResult, String> {
        let known_hosts_path = Self::vibe_dir()?.join("known_hosts");
        let record = HostKeyRecord {
            host: if port == 22 { host.to_string() } else { format!("[{}]:{}", host, port) },
            algorithm: public_key.name().to_string(),
            fingerprint: public_key.fingerprint(),
            key_base64: public_key.public_key_base64(),
        };

        match russh_keys::check_known_hosts_path(host, port, public_key, &known_hosts_path) {
            Ok(true) => Ok(HostKeyScanResult {
                trusted: true,
                fingerprint_changed: false,
                record,
            }),
            Ok(false) => Ok(HostKeyScanResult {
                trusted: false,
                fingerprint_changed: false,
                record,
            }),
            Err(_) => Ok(HostKeyScanResult {
                trusted: false,
                fingerprint_changed: true,
                record,
            }),
        }
    }

    pub fn trust_host_key(host: &str, port: u16, key_base64: &str) -> Result<(), String> {
        let public_key = russh_keys::parse_public_key_base64(key_base64)
            .map_err(|e| format!("Failed to parse host key: {}", e))?;
        let known_hosts_path = Self::vibe_dir()?.join("known_hosts");
        russh_keys::learn_known_hosts_path(host, port, &public_key, known_hosts_path)
            .map_err(|e| format!("Failed to persist host key: {}", e))
    }

    pub fn list_host_keys() -> Result<Vec<HostKeyRecord>, String> {
        let known_hosts_path = Self::vibe_dir()?.join("known_hosts");
        if !known_hosts_path.exists() {
            return Ok(vec![]);
        }

        let content = fs::read_to_string(known_hosts_path).map_err(|e| e.to_string())?;
        let mut records = Vec::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let mut parts = trimmed.split_whitespace();
            let host = match parts.next() {
                Some(value) => value.to_string(),
                None => continue,
            };
            let algorithm = match parts.next() {
                Some(value) => value.to_string(),
                None => continue,
            };
            let key_base64 = match parts.next() {
                Some(value) => value.to_string(),
                None => continue,
            };

            let public_key = russh_keys::parse_public_key_base64(&key_base64)
                .map_err(|e| format!("Failed to parse known_hosts entry: {}", e))?;

            records.push(HostKeyRecord {
                host,
                algorithm,
                fingerprint: public_key.fingerprint(),
                key_base64,
            });
        }

        Ok(records)
    }

    pub fn remove_host_key(host: &str, key_base64: &str) -> Result<(), String> {
        let known_hosts_path = Self::vibe_dir()?.join("known_hosts");
        if !known_hosts_path.exists() {
            return Ok(());
        }

        let content = fs::read_to_string(&known_hosts_path).map_err(|e| e.to_string())?;
        let filtered = content
            .lines()
            .filter(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    return true;
                }

                let mut parts = trimmed.split_whitespace();
                let line_host = parts.next().unwrap_or_default();
                let _algorithm = parts.next();
                let line_key = parts.next().unwrap_or_default();
                !(line_host == host && line_key == key_base64)
            })
            .collect::<Vec<_>>()
            .join("\n");

        let final_content = if filtered.is_empty() {
            String::new()
        } else {
            format!("{}\n", filtered)
        };

        fs::write(known_hosts_path, final_content).map_err(|e| e.to_string())
    }
}
