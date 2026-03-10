use russh::{client, ChannelId};
use russh_keys::key::PublicKey;
use russh_sftp::client::SftpSession;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use crate::ssh::config::SecureStorage;

struct SftpAuthClient {
    host: String,
    port: u16,
}

#[async_trait::async_trait]
impl client::Handler for SftpAuthClient {
    type Error = russh::Error;

    async fn check_server_key(
        self,
        server_public_key: &PublicKey,
    ) -> Result<(Self, bool), Self::Error> {
        let trusted = SecureStorage::verify_or_learn_host_key(&self.host, self.port, server_public_key)
            .unwrap_or(false);
        Ok((self, trusted))
    }

    async fn data(
        self,
        _channel: ChannelId,
        _data: &[u8],
        session: client::Session,
    ) -> Result<(Self, client::Session), Self::Error> {
        Ok((self, session))
    }
}

pub struct SftpClient {
    session: SftpSession,
    pub current_path: String,
}

impl SftpClient {
    pub async fn connect(host: &str, port: u16, user: &str, password: &str) -> Result<Self, String> {
        let addr = format!("{}:{}", host, port);
        let socket = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("SFTP Connection failed: {}", e))?;
        socket.set_nodelay(true).ok();

        let config = Arc::new(russh::client::Config {
            keepalive_interval: Some(std::time::Duration::from_secs(15)),
            keepalive_max: 3,
            inactivity_timeout: Some(std::time::Duration::from_secs(300)),
            ..Default::default()
        });

        let mut session = russh::client::connect_stream(config, socket, SftpAuthClient {
            host: host.to_string(),
            port,
        })
            .await
            .map_err(|e| format!("SFTP handshake failed: {}", e))?;

        let mut authed = false;

        if let Some(home_dir) = dirs::home_dir() {
            let keys = vec![
                home_dir.join(".ssh/id_ed25519"),
                home_dir.join(".ssh/id_rsa"),
                home_dir.join(".ssh/id_ecdsa"),
            ];

            for key_path in keys {
                if key_path.exists() {
                    if let Ok(key_data) = std::fs::read_to_string(&key_path) {
                        if let Ok(key_pair) = russh_keys::decode_secret_key(&key_data, None) {
                            if let Ok(success) = session.authenticate_publickey(user, Arc::new(key_pair)).await {
                                if success {
                                    authed = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if !authed && !password.is_empty() {
            authed = session
                .authenticate_password(user, password)
                .await
                .map_err(|e| format!("SFTP auth failed: {}", e))?;
        }

        if !authed {
            return Err("SFTP authentication rejected".to_string());
        }

        let channel = session
            .channel_open_session()
            .await
            .map_err(|e| format!("SFTP channel open failed: {}", e))?;

        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("SFTP subsystem request failed: {}", e))?;

        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("SFTP session init failed: {}", e))?;

        let current_path = sftp
            .canonicalize(".")
            .await
            .unwrap_or_else(|_| "/".to_string());

        Ok(Self {
            session: sftp,
            current_path,
        })
    }

    pub async fn list(&self, path: Option<&str>) -> Result<Vec<String>, String> {
        let target = path.unwrap_or(self.current_path.as_str());
        let entries = self.session
            .read_dir(target)
            .await
            .map_err(|e| format!("SFTP LIST failed: {}", e))?;

        let mut files = Vec::new();
        for entry in entries {
            let mut name = entry.file_name();
            if entry.file_type().is_dir() {
                name.push('/');
            }
            files.push(name);
        }
        files.sort();
        Ok(files)
    }

    pub async fn change_dir(&mut self, path: &str) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        let canonical = self.session
            .canonicalize(target)
            .await
            .map_err(|e| format!("SFTP CWD failed: {}", e))?;

        self.session
            .read_dir(canonical.clone())
            .await
            .map_err(|e| format!("SFTP CWD failed: {}", e))?;

        self.current_path = canonical;
        Ok(())
    }

    pub async fn disconnect(self) -> Result<(), String> {
        self.session
            .close()
            .await
            .map_err(|e| format!("SFTP close failed: {}", e))
    }

    pub async fn read_file(&self, path: &str) -> Result<String, String> {
        let bytes = self.read_bytes(path).await?;

        String::from_utf8(bytes)
            .map_err(|_| "SFTP READ failed: remote file is not valid UTF-8 text".to_string())
    }

    pub async fn write_file(&self, path: &str, content: &str) -> Result<(), String> {
        self.write_bytes(path, content.as_bytes()).await
    }

    pub async fn read_bytes(&self, path: &str) -> Result<Vec<u8>, String> {
        let target = self.resolve_target_path(path);
        let mut file = self.session
            .open(target)
            .await
            .map_err(|e| format!("SFTP READ failed: {}", e))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .await
            .map_err(|e| format!("SFTP READ failed: {}", e))?;
        Ok(buffer)
    }

    pub async fn write_bytes(&self, path: &str, data: &[u8]) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        let mut file = self.session
            .create(target)
            .await
            .map_err(|e| format!("SFTP WRITE failed: {}", e))?;

        file.write_all(data)
            .await
            .map_err(|e| format!("SFTP WRITE failed: {}", e))?;
        file.shutdown()
            .await
            .map_err(|e| format!("SFTP WRITE failed: {}", e))?;
        Ok(())
    }

    pub async fn create_dir(&self, path: &str) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        self.session
            .create_dir(target)
            .await
            .map_err(|e| format!("SFTP MKDIR failed: {}", e))
    }

    pub async fn rename_path(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let source = self.resolve_target_path(old_path);
        let target = if new_path.starts_with('/') {
            new_path.to_string()
        } else {
            let parent = parent_path(&source);
            join_remote_path(&parent, new_path)
        };

        self.session
            .rename(source, target)
            .await
            .map_err(|e| format!("SFTP RENAME failed: {}", e))
    }

    pub async fn delete_path(&self, path: &str) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        match self.session.metadata(target.clone()).await {
            Ok(metadata) if metadata.is_dir() => self.session
                .remove_dir(target)
                .await
                .map_err(|e| format!("SFTP DELETE failed: {}", e)),
            Ok(_) => self.session
                .remove_file(target)
                .await
                .map_err(|e| format!("SFTP DELETE failed: {}", e)),
            Err(e) => Err(format!("SFTP DELETE failed: {}", e)),
        }
    }

    fn resolve_target_path(&self, path: &str) -> String {
        if path == ".." {
            return parent_path(&self.current_path);
        }
        if path.starts_with('/') {
            return path.trim_end_matches('/').to_string().if_empty_then_root();
        }

        join_remote_path(&self.current_path, path)
    }
}

fn join_remote_path(base: &str, child: &str) -> String {
    let base = if base.is_empty() { "/" } else { base };
    if base == "/" {
        format!("/{}", child.trim_matches('/'))
    } else {
        format!("{}/{}", base.trim_end_matches('/'), child.trim_matches('/'))
    }
}

fn parent_path(path: &str) -> String {
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }

    let parent = Path::new(path)
        .parent()
        .unwrap_or_else(|| Path::new("/"));
    normalize_remote_path(parent)
}

fn normalize_remote_path(path: &Path) -> String {
    let buf = PathBuf::from(path);
    let rendered = buf.to_string_lossy().replace('\\', "/");
    if rendered.is_empty() {
        "/".to_string()
    } else {
        rendered
    }
}

trait RootFallback {
    fn if_empty_then_root(self) -> String;
}

impl RootFallback for String {
    fn if_empty_then_root(self) -> String {
        if self.is_empty() { "/".to_string() } else { self }
    }
}
