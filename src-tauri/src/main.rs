// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod ftp;
mod sftp;
mod ai;
mod agent;
mod app;
mod plugins;
mod storage;
mod encryption;
mod session;
mod history;
mod groups;
mod workspace;

use ai::{AiConfig, AiProvider, ChatMessage};
use agent::{AgentRequest, AgentResponse};
use app::ProviderProfile;
use ssh::config::{HostKeyRecord, HostKeyScanResult, ServerConfig, SecureStorage};
use ssh::SessionRegistry;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use storage::StorageService;
use encryption::EncryptionService;
use session::SessionManager;
use history::HistoryManager;
use groups::GroupManager;
use workspace::WorkspaceManager;

pub struct AppState {
    pub ssh_sessions: Arc<Mutex<SessionRegistry>>,
    pub ftp_sessions: Arc<Mutex<HashMap<String, ftp::FtpClient>>>,
    pub sftp_sessions: Arc<Mutex<HashMap<String, sftp::SftpClient>>>,
    pub session_manager: Arc<SessionManager>,
    pub history_manager: Arc<HistoryManager>,
    pub group_manager: Arc<GroupManager>,
    pub workspace_manager: Arc<WorkspaceManager>,
}

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum RemoteFileProtocol {
    Ftp,
    Sftp,
}

// ─── Server Config Commands ────────────────────────────────────────

#[tauri::command]
async fn get_servers() -> Result<Vec<ServerConfig>, String> {
    SecureStorage::load_servers()
}

#[tauri::command]
async fn save_server(server: ServerConfig) -> Result<(), String> {
    let mut servers = SecureStorage::load_servers()?;
    if let Some(pos) = servers.iter().position(|s| s.id == server.id) {
        servers[pos] = server;
    } else {
        servers.push(server);
    }
    SecureStorage::save_servers(&servers)
}

#[tauri::command]
async fn delete_server(id: String) -> Result<(), String> {
    let mut servers = SecureStorage::load_servers()?;
    servers.retain(|s| s.id != id);
    SecureStorage::save_servers(&servers)
}

#[tauri::command]
async fn save_server_password(server_id: String, password: String) -> Result<(), String> {
    SecureStorage::save_password(&server_id, &password)
}

#[tauri::command]
async fn get_server_password(server_id: String) -> Result<String, String> {
    SecureStorage::get_password(&server_id)
}

#[tauri::command]
async fn delete_server_password(server_id: String) -> Result<(), String> {
    SecureStorage::delete_password(&server_id)
}

#[tauri::command]
async fn save_server_private_key(server_id: String, private_key: String) -> Result<(), String> {
    SecureStorage::save_private_key(&server_id, &private_key)
}

#[tauri::command]
async fn get_server_private_key(server_id: String) -> Result<String, String> {
    SecureStorage::get_private_key(&server_id)
}

#[tauri::command]
async fn delete_server_private_key(server_id: String) -> Result<(), String> {
    SecureStorage::delete_private_key(&server_id)
}

#[tauri::command]
async fn ssh_scan_host_key(host: String, port: u16) -> Result<HostKeyScanResult, String> {
    use russh::client;
    use russh_keys::key::PublicKey;
    use std::sync::Arc;
    use tokio::net::TcpStream;
    use tokio::sync::oneshot;

    struct ScanClient {
        host: String,
        port: u16,
        tx: Option<oneshot::Sender<Result<HostKeyScanResult, String>>>,
    }

    #[async_trait::async_trait]
    impl client::Handler for ScanClient {
        type Error = russh::Error;

        async fn check_server_key(
            mut self,
            server_public_key: &PublicKey,
        ) -> Result<(Self, bool), Self::Error> {
            if let Some(tx) = self.tx.take() {
                let _ = tx.send(SecureStorage::host_key_scan_result(&self.host, self.port, server_public_key));
            }
            Ok((self, false))
        }
    }

    let socket = TcpStream::connect(format!("{}:{}", host, port))
        .await
        .map_err(|e| format!("Host key scan connection failed: {}", e))?;
    socket.set_nodelay(true).ok();

    let config = Arc::new(russh::client::Config::default());
    let (tx, rx) = oneshot::channel::<Result<HostKeyScanResult, String>>();

    let _ = russh::client::connect_stream(config, socket, ScanClient {
        host,
        port,
        tx: Some(tx),
    }).await;

    rx.await.map_err(|_| "Failed to receive host key during SSH handshake".to_string())?
}

#[tauri::command]
async fn ssh_trust_host_key(host: String, port: u16, key_base64: String) -> Result<(), String> {
    SecureStorage::trust_host_key(&host, port, &key_base64)
}

#[tauri::command]
async fn list_known_host_keys() -> Result<Vec<HostKeyRecord>, String> {
    SecureStorage::list_host_keys()
}

#[tauri::command]
async fn remove_known_host_key(host: String, key_base64: String) -> Result<(), String> {
    SecureStorage::remove_host_key(&host, &key_base64)
}

// ─── SSH Commands ──────────────────────────────────────────────────

#[tauri::command]
async fn ssh_connect(
    session_id: String,
    host: String,
    port: u16,
    user: String,
    password: String,
    private_key: Option<String>,
    private_key_passphrase: Option<String>,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    ssh::connect(
        session_id,
        host,
        port,
        user,
        password,
        private_key,
        private_key_passphrase,
        state.ssh_sessions.clone(),
        app
    ).await
}

#[tauri::command]
async fn ssh_write(
    session_id: String,
    data: Vec<u8>,
    state: tauri::State<'_, AppState>,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    ssh::write(&session_id, data, state.ssh_sessions.clone()).await
}

#[tauri::command]
async fn ssh_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    ssh::resize(&session_id, cols, rows, state.ssh_sessions.clone()).await
}

#[tauri::command]
async fn ssh_disconnect(
    session_id: String,
    state: tauri::State<'_, AppState>,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    ssh::disconnect(&session_id, state.ssh_sessions.clone()).await;
    Ok(())
}

#[tauri::command]
async fn ssh_drain_output(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Vec<u8>>, String> {
    ssh::session::drain_output(&session_id, state.ssh_sessions.clone()).await
}

#[tauri::command]
async fn ssh_drain_status(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ssh::session::SshStatusEvent>, String> {
    ssh::session::drain_status(&session_id, state.ssh_sessions.clone()).await
}

#[tauri::command]
async fn ssh_test_connection(host: String, port: u16, _user: String) -> Result<String, String> {
    use tokio::net::TcpStream;
    let start = std::time::Instant::now();
    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;
    let _ = stream.set_nodelay(true);
    Ok(format!("Reachable · {}ms", start.elapsed().as_millis()))
}

// ─── FTP Commands ──────────────────────────────────────────────────

#[tauri::command]
async fn ftp_connect(
    session_id: String,
    host: String,
    port: u16,
    user: String,
    password: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let client = ftp::FtpClient::connect(&host, port, &user, &password).await?;
    let mut reg = state.ftp_sessions.lock().await;
    reg.insert(session_id, client);
    Ok(())
}

#[tauri::command]
async fn ftp_list(
    session_id: String,
    path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let mut reg = state.ftp_sessions.lock().await;
    if let Some(client) = reg.get_mut(&session_id) {
        client.list(path.as_deref()).await
    } else {
        Err(format!("FTP Session not found: {}", session_id))
    }
}

#[tauri::command]
async fn ftp_cd(
    session_id: String,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut reg = state.ftp_sessions.lock().await;
    if let Some(client) = reg.get_mut(&session_id) {
        client.change_dir(&path).await
    } else {
        Err(format!("FTP Session not found: {}", session_id))
    }
}

#[tauri::command]
async fn ftp_disconnect(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut reg = state.ftp_sessions.lock().await;
    if let Some(client) = reg.remove(&session_id) {
        client.disconnect().await?;
    }
    Ok(())
}

// ─── Remote Files Commands ────────────────────────────────────────

#[tauri::command]
async fn remote_files_connect(
    protocol: RemoteFileProtocol,
    session_id: String,
    host: String,
    port: u16,
    user: String,
    password: String,
    private_key: Option<String>,
    private_key_passphrase: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => ftp_connect(session_id, host, port, user, password, state).await,
        RemoteFileProtocol::Sftp => {
            let client = sftp::SftpClient::connect(
                &host,
                port,
                &user,
                &password,
                private_key.as_deref(),
                private_key_passphrase.as_deref(),
            ).await?;
            let mut reg = state.sftp_sessions.lock().await;
            reg.insert(session_id, client);
            Ok(())
        }
    }
}

#[tauri::command]
async fn remote_files_list(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    match protocol {
        RemoteFileProtocol::Ftp => ftp_list(session_id, path, state).await,
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.list(path.as_deref()).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_cd(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => ftp_cd(session_id, path, state).await,
        RemoteFileProtocol::Sftp => {
            let mut reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.change_dir(&path).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_disconnect(
    protocol: RemoteFileProtocol,
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => ftp_disconnect(session_id, state).await,
        RemoteFileProtocol::Sftp => {
            let mut reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.remove(&session_id) {
                client.disconnect().await?;
            }
            Ok(())
        }
    }
}

#[tauri::command]
async fn remote_files_read(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.read_file(&path).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.read_file(&path).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_write(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    content: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.write_file(&path, &content).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.write_file(&path, &content).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_download(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.read_bytes(&path).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.read_bytes(&path).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_upload(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    data: Vec<u8>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.write_bytes(&path, &data).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.write_bytes(&path, &data).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_mkdir(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.create_dir(&path).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.create_dir(&path).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_rename(
    protocol: RemoteFileProtocol,
    session_id: String,
    old_path: String,
    new_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.rename_path(&old_path, &new_path).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.rename_path(&old_path, &new_path).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

#[tauri::command]
async fn remote_files_delete(
    protocol: RemoteFileProtocol,
    session_id: String,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    match protocol {
        RemoteFileProtocol::Ftp => {
            let mut reg = state.ftp_sessions.lock().await;
            if let Some(client) = reg.get_mut(&session_id) {
                client.delete_path(&path).await
            } else {
                Err(format!("FTP Session not found: {}", session_id))
            }
        }
        RemoteFileProtocol::Sftp => {
            let reg = state.sftp_sessions.lock().await;
            if let Some(client) = reg.get(&session_id) {
                client.delete_path(&path).await
            } else {
                Err(format!("SFTP Session not found: {}", session_id))
            }
        }
    }
}

// ─── AI Commands ──────────────────────────────────────────────────

#[tauri::command]
async fn ai_chat(
    provider: String,
    model: String,
    ollama_url: String,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    // Try to get API key from localStorage (passed via frontend)
    let api_key = match provider.as_str() {
        "openai" | "anthropic" => {
            // For now, we'll expect the frontend to handle API key management
            // In a future update, we could add secure storage for API keys
            None
        },
        _ => None,
    };
    
    let config = AiConfig {
        provider: match provider.as_str() {
            "openai"    => AiProvider::OpenAI,
            "anthropic" => AiProvider::Anthropic,
            _           => AiProvider::Ollama,
        },
        model,
        ollama_base_url: ollama_url,
        api_key,
        max_context_tokens: 8192,
    };
    ai::chat(&config, messages).await
}

#[tauri::command]
async fn ai_chat_stream(
    provider: String,
    model: String,
    ollama_url: String,
    messages: Vec<ChatMessage>,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    // Try to get API key from localStorage (passed via frontend)
    let api_key = match provider.as_str() {
        "openai" | "anthropic" => {
            // For now, we'll expect the frontend to handle API key management
            // In a future update, we could add secure storage for API keys
            None
        },
        _ => None,
    };
    
    let config = AiConfig {
        provider: match provider.as_str() {
            "openai" => AiProvider::OpenAI,
            "anthropic" => AiProvider::Anthropic,
            _ => AiProvider::Ollama,
        },
        model,
        ollama_base_url: ollama_url,
        api_key,
        max_context_tokens: 8192,
    };
    ai::chat_stream(&config, messages, on_chunk).await
}

#[tauri::command]
async fn ai_chat_with_config(
    provider: String,
    model: String,
    ollama_url: String,
    api_key: Option<String>,
    max_context_tokens: Option<usize>,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    let config = AiConfig {
        provider: match provider.as_str() {
            "openai"    => AiProvider::OpenAI,
            "anthropic" => AiProvider::Anthropic,
            _           => AiProvider::Ollama,
        },
        model,
        ollama_base_url: ollama_url,
        api_key,
        max_context_tokens: max_context_tokens.unwrap_or(8192),
    };
    ai::chat(&config, messages).await
}

#[tauri::command]
async fn ai_chat_stream_with_config(
    provider: String,
    model: String,
    ollama_url: String,
    api_key: Option<String>,
    max_context_tokens: Option<usize>,
    messages: Vec<ChatMessage>,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    let config = AiConfig {
        provider: match provider.as_str() {
            "openai" => AiProvider::OpenAI,
            "anthropic" => AiProvider::Anthropic,
            _ => AiProvider::Ollama,
        },
        model,
        ollama_base_url: ollama_url,
        api_key,
        max_context_tokens: max_context_tokens.unwrap_or(8192),
    };
    ai::chat_stream(&config, messages, on_chunk).await
}

#[tauri::command]
async fn list_ollama_models(ollama_url: String) -> Result<Vec<String>, String> {
    ai::list_ollama_models(&ollama_url).await
}

#[tauri::command]
async fn start_ollama_service(ollama_url: String) -> Result<Vec<String>, String> {
    if let Ok(models) = ai::list_ollama_models(&ollama_url).await {
        return Ok(models);
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-a")
            .arg("Ollama")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }

    let _ = std::process::Command::new("ollama")
        .arg("serve")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();

    let mut last_error = "Ollama did not start in time.".to_string();
    for _ in 0..8 {
        sleep(Duration::from_millis(1250)).await;
        match ai::list_ollama_models(&ollama_url).await {
            Ok(models) => return Ok(models),
            Err(error) => last_error = error,
        }
    }

    Err(last_error)
}

#[tauri::command]
async fn list_ai_provider_profiles() -> Result<Vec<ProviderProfile>, String> {
    Ok(app::default_provider_profiles())
}

#[tauri::command]
async fn run_agent_task(
    provider: String,
    model: String,
    ollama_url: String,
    request: AgentRequest,
) -> Result<AgentResponse, String> {
    let config = AiConfig {
        provider: match provider.as_str() {
            "openai" => AiProvider::OpenAI,
            "anthropic" => AiProvider::Anthropic,
            _ => AiProvider::Ollama,
        },
        model,
        ollama_base_url: ollama_url,
        api_key: None,
        max_context_tokens: 8192,
    };

    let messages = agent::to_chat_messages(&request);
    let content = ai::chat(&config, messages).await?;
    Ok(agent::fallback_response(&request, content))
}

// ─── Session Management Commands ──────────────────────────────────

#[tauri::command]
async fn save_connection_config(
    config: session::ConnectionConfig,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.session_manager.save_connection(config).await
}

#[tauri::command]
async fn load_connection_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<session::ConnectionConfig>, String> {
    state.session_manager.load_connections().await
}

#[tauri::command]
async fn delete_connection_config(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.session_manager.delete_connection(&id).await
}

#[tauri::command]
async fn update_connection_last_used(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.session_manager.update_last_used(&id).await
}

// ─── Command History Commands ─────────────────────────────────────

#[tauri::command]
async fn append_command_history(
    server_id: String,
    command: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.history_manager.append_command(&server_id, command).await
}

#[tauri::command]
async fn load_command_history(
    server_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<history::HistoryEntry>, String> {
    state.history_manager.load_history(&server_id).await
}

#[tauri::command]
async fn search_command_history(
    server_id: String,
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<history::HistoryEntry>, String> {
    state.history_manager.search_history(&server_id, &query).await
}

#[tauri::command]
async fn clear_command_history(
    server_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.history_manager.clear_history(&server_id).await
}

// ─── Server Group Commands ────────────────────────────────────────

#[tauri::command]
async fn save_server_group(
    group: groups::ServerGroup,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.group_manager.save_group(group).await
}

#[tauri::command]
async fn load_server_groups(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<groups::ServerGroup>, String> {
    state.group_manager.load_groups().await
}

#[tauri::command]
async fn delete_server_group(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.group_manager.delete_group(&id).await
}

#[tauri::command]
async fn add_server_to_group(
    group_id: String,
    server_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.group_manager.add_server_to_group(&group_id, &server_id).await
}

#[tauri::command]
async fn remove_server_from_group(
    group_id: String,
    server_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.group_manager.remove_server_from_group(&group_id, &server_id).await
}

#[tauri::command]
async fn toggle_group_collapsed(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.group_manager.toggle_group_collapsed(&id).await
}

#[tauri::command]
async fn reorder_server_groups(
    group_ids: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.group_manager.reorder_groups(group_ids).await
}

// ─── Workspace Commands ────────────────────────────────────────────

#[tauri::command]
async fn save_workspace_state(
    workspace_state: workspace::WorkspaceState,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.workspace_manager.save_workspace(workspace_state).await
}

#[tauri::command]
async fn load_workspace_state(
    state: tauri::State<'_, AppState>,
) -> Result<Option<workspace::WorkspaceState>, String> {
    state.workspace_manager.load_workspace().await
}

#[tauri::command]
async fn clear_workspace_state(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.workspace_manager.clear_workspace().await
}

// ─── Main ─────────────────────────────────────────────────────────

fn main() {
    // Initialize storage and encryption services
    let storage = Arc::new(StorageService::new().expect("Failed to initialize storage service"));
    let encryption = Arc::new(EncryptionService::new("com.vibeshell.dev"));
    let session_manager = Arc::new(SessionManager::new(storage.clone(), encryption));
    let history_manager = Arc::new(HistoryManager::new(storage.clone()));
    let group_manager = Arc::new(GroupManager::new(storage.clone()));
    let workspace_manager = Arc::new(WorkspaceManager::new(storage));

    tauri::Builder::default()
        .manage(AppState {
            ssh_sessions: Arc::new(Mutex::new(SessionRegistry::new())),
            ftp_sessions: Arc::new(Mutex::new(HashMap::new())),
            sftp_sessions: Arc::new(Mutex::new(HashMap::new())),
            session_manager,
            history_manager: history_manager.clone(),
            group_manager,
            workspace_manager,
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_servers,
            save_server,
            delete_server,
            save_server_password,
            delete_server_password,
            save_server_private_key,
            get_server_private_key,
            delete_server_private_key,
            get_server_password,
            ssh_scan_host_key,
            ssh_trust_host_key,
            list_known_host_keys,
            remove_known_host_key,
            ssh_connect,
            ssh_write,
            ssh_resize,
            ssh_disconnect,
            ssh_drain_output,
            ssh_drain_status,
            ssh_test_connection,
            ftp_connect,
            ftp_list,
            ftp_cd,
            ftp_disconnect,
            remote_files_connect,
            remote_files_list,
            remote_files_cd,
            remote_files_disconnect,
            remote_files_read,
            remote_files_write,
            remote_files_download,
            remote_files_upload,
            remote_files_mkdir,
            remote_files_rename,
            remote_files_delete,
            ai_chat,
            ai_chat_stream,
            ai_chat_with_config,
            ai_chat_stream_with_config,
            list_ollama_models,
            start_ollama_service,
            list_ai_provider_profiles,
            run_agent_task,
            save_connection_config,
            load_connection_configs,
            delete_connection_config,
            update_connection_last_used,
            append_command_history,
            load_command_history,
            search_command_history,
            clear_command_history,
            save_server_group,
            load_server_groups,
            delete_server_group,
            add_server_to_group,
            remove_server_from_group,
            toggle_group_collapsed,
            reorder_server_groups,
            save_workspace_state,
            load_workspace_state,
            clear_workspace_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
