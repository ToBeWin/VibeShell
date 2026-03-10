use russh::{client, Channel, ChannelId};
use russh::ChannelMsg;
use russh_keys::key::PublicKey;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex};
use std::collections::{HashMap, VecDeque};
use super::config::SecureStorage;

// ─── Control actions for SSH session ──────────────────────────────
pub enum SshAction {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
}

// ─── Event sent from SSH → frontend ───────────────────────────────
#[derive(Clone, serde::Serialize)]
pub struct SshOutputEvent {
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Clone, serde::Serialize)]
pub struct SshStatusEvent {
    pub session_id: String,
    pub level: String,
    pub message: String,
}

// ─── Per-session state ─────────────────────────────────────────────
pub struct SshSession {
    pub id: String,
    pub host: String,
    pub tx: mpsc::Sender<SshAction>, // send actions IN to channel task
    pub output_buffer: Arc<Mutex<VecDeque<Vec<u8>>>>,
    pub status_buffer: Arc<Mutex<VecDeque<SshStatusEvent>>>,
    // FIXED: Use Arc<Mutex<>> for shared ownership instead of moved handle
    pub session: Arc<Mutex<Option<client::Handle<VibeClient>>>>,
    pub channel: Arc<Mutex<Option<Channel<client::Msg>>>>,
}

// ─── Global session registry ───────────────────────────────────────
pub struct SessionRegistry {
    pub sessions: HashMap<String, SshSession>,
}

impl SessionRegistry {
    pub fn new() -> Self { Self { sessions: HashMap::new() } }
}

async fn push_status(
    status_buffer: &Arc<Mutex<VecDeque<SshStatusEvent>>>,
    session_id: &str,
    level: &str,
    message: impl Into<String>,
) {
    let mut buffer = status_buffer.lock().await;
    buffer.push_back(SshStatusEvent {
        session_id: session_id.to_string(),
        level: level.to_string(),
        message: message.into(),
    });
    while buffer.len() > 256 {
        buffer.pop_front();
    }
}

// ─── russh client handler ─────────────────────────────────────────
pub(crate) struct VibeClient {
    host: String,
    port: u16,
}

#[async_trait::async_trait]
impl client::Handler for VibeClient {
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

    async fn extended_data(
        self,
        _channel: ChannelId,
        _ext: u32,
        _data: &[u8],
        session: client::Session,
    ) -> Result<(Self, client::Session), Self::Error> {
        Ok((self, session))
    }
}

// ─── Connect helper ────────────────────────────────────────────────
pub async fn connect(
    session_id: String,
    host: String,
    port: u16,
    user: String,
    password: String,
    registry: Arc<Mutex<SessionRegistry>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let addr = format!("{}:{}", host, port);

    let socket = TcpStream::connect(&addr).await.map_err(|e| e.to_string())?;
    socket.set_nodelay(true).ok();

    let config = Arc::new(russh::client::Config {
        keepalive_interval: Some(std::time::Duration::from_secs(15)),
        keepalive_max: 3,
        inactivity_timeout: None,
        ..Default::default()
    });

    let handler = VibeClient {
        host: host.clone(),
        port,
    };

    let mut session = russh::client::connect_stream(config, socket, handler)
        .await
        .map_err(|e| format!("SSH handshake failed: {}", e))?;

    let mut authed = false;

    // Try public key auth first
    if let Some(home_dir) = dirs::home_dir() {
        let keys = vec![
            home_dir.join(".ssh/id_ed25519"),
            home_dir.join(".ssh/id_rsa"),
            home_dir.join(".ssh/id_ecdsa"),
        ];

        for key_path in keys {
            if key_path.exists() {
                if let Ok(key_data) = std::fs::read_to_string(&key_path) {
                    // Quick and dirty load key. In production we might need passphrases.
                    if let Ok(key_pair) = russh_keys::decode_secret_key(&key_data, None) {
                        if let Ok(success) = session.authenticate_publickey(&user, Arc::new(key_pair)).await {
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

    // Fallback to password auth
    if !authed && !password.is_empty() {
        authed = session
            .authenticate_password(&user, &password)
            .await
            .map_err(|e| format!("Auth failed: {}", e))?;
    }

    if !authed {
        return Err("Authentication rejected".to_string());
    }

    let channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("Channel open failed: {}", e))?;

    channel
        .request_pty(
            true,
            "xterm-256color",
            120, 40,
            0, 0,
            &[],
        )
        .await
        .map_err(|e| format!("PTY request failed: {}", e))?;

    channel
        .request_shell(true)
        .await
        .map_err(|e| format!("Shell request failed: {}", e))?;
    
    // Channel ID not needed since we store the whole channel object
    // let _channel_id = channel.id();

    let output_buffer = Arc::new(Mutex::new(VecDeque::<Vec<u8>>::new()));
    let status_buffer = Arc::new(Mutex::new(VecDeque::<SshStatusEvent>::new()));

    let (input_tx, mut input_rx) = mpsc::channel::<SshAction>(256);

    // FIXED: Create Arc-wrapped session and channel for shared ownership
    let session_handle = Arc::new(Mutex::new(Some(session)));
    let channel_handle = Arc::new(Mutex::new(Some(channel)));

    {
        let mut reg = registry.lock().await;
        reg.sessions.insert(session_id.clone(), SshSession {
            id: session_id.clone(),
            host: host.clone(),
            tx: input_tx,
            output_buffer: output_buffer.clone(),
            status_buffer: status_buffer.clone(),
            session: session_handle.clone(),
            channel: channel_handle.clone(),
        });
    }

    push_status(&status_buffer, &session_id, "info", "SSH session connected").await;

    let sid_status = session_id.clone();
    let app_status = app.clone();
    let _output_buffer_task = output_buffer.clone();
    let status_buffer_task = status_buffer.clone();
    
    // FIXED: Take channel out of Arc for the async task
    // The channel is moved into the task and won't be accessed elsewhere
    let mut channel = {
        let mut guard = channel_handle.lock().await;
        guard.take().expect("Channel should be available")
    };
    
    tokio::spawn(async move {
        loop {
            tokio::select! {
                maybe_action = input_rx.recv() => {
                    let Some(action) = maybe_action else {
                        break;
                    };

                    // FIXED: Use channel directly without locking
                    let result = match action {
                        SshAction::Data(data) => {
                            channel.data(data.as_ref()).await.map(|_| ())
                        }
                        SshAction::Resize { cols, rows } => {
                            channel.window_change(cols, rows, 0, 0).await.map(|_| ())
                        }
                    };

                    if let Err(error) = result {
                        push_status(&status_buffer_task, &sid_status, "error", format!("SSH channel closed: {}", error)).await;
                        use tauri::Emitter;
                        let _ = app_status.emit(
                            &format!("ssh-status-{}", sid_status),
                            SshStatusEvent {
                                session_id: sid_status.clone(),
                                level: "error".to_string(),
                                message: format!("SSH channel closed: {}", error),
                            },
                        );
                        break;
                    }
                }
                // FIXED: Read from channel directly without locking
                maybe_msg = channel.wait() => {
                    let Some(msg) = maybe_msg else {
                        break;
                    };

                    match msg {
                        ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                            // NOTE: We only use events, not buffer, to avoid dual-read data race
                            // Data is sent directly to frontend via events
                            
                            // Emit event to frontend (only once, using window.emit for direct delivery)
                            use tauri::{Manager, Emitter};
                            if let Some(window) = app_status.get_webview_window("main") {
                                let event_name = format!("ssh-output-{}", sid_status);
                                let event_payload = SshOutputEvent {
                                    session_id: sid_status.clone(),
                                    data: data.to_vec(),
                                };
                                let _ = window.emit(&event_name, event_payload);
                            }
                        }
                        ChannelMsg::Eof | ChannelMsg::Close => {
                            break;
                        }
                        ChannelMsg::ExitStatus { exit_status: _ } => {
                            // Session ended, will break on next Eof/Close
                        }
                        _ => {}
                    }
                }
            }
        }
    });

    Ok(())
}

pub async fn write(
    session_id: &str,
    data: Vec<u8>,
    registry: Arc<Mutex<SessionRegistry>>,
) -> Result<(), String> {
    let tx = {
        let reg = registry.lock().await;
        reg.sessions
            .get(session_id)
            .map(|sess| sess.tx.clone())
            .ok_or_else(|| format!("No session with id: {}", session_id))?
    };

    // Send data through the channel - the async task will handle it
    tx.send(SshAction::Data(data))
        .await
        .map_err(|e| format!("Failed to send data: {}", e))
}

pub async fn resize(
    session_id: &str,
    cols: u32,
    rows: u32,
    registry: Arc<Mutex<SessionRegistry>>,
) -> Result<(), String> {
    let tx = {
        let reg = registry.lock().await;
        reg.sessions
            .get(session_id)
            .map(|sess| sess.tx.clone())
            .ok_or_else(|| format!("No session with id: {}", session_id))?
    };

    tx.send(SshAction::Resize { cols, rows })
        .await
        .map_err(|e| e.to_string())
}

pub async fn disconnect(
    session_id: &str,
    registry: Arc<Mutex<SessionRegistry>>,
) {
    let mut reg = registry.lock().await;
    
    // FIXED: Properly clean up session and channel before removing
    if let Some(sess) = reg.sessions.get(session_id) {
        // Clear session handle
        {
            let mut session_guard = sess.session.lock().await;
            if let Some(session) = session_guard.take() {
                // Attempt graceful disconnect
                let _ = session.disconnect(russh::Disconnect::ByApplication, "", "en").await;
            }
        }
        
        // Clear channel
        {
            let mut channel_guard = sess.channel.lock().await;
            *channel_guard = None;
        }
    }
    
    reg.sessions.remove(session_id);
}

pub async fn drain_output(
    session_id: &str,
    registry: Arc<Mutex<SessionRegistry>>,
) -> Result<Vec<Vec<u8>>, String> {
    let buffer = {
        let reg = registry.lock().await;
        reg.sessions
            .get(session_id)
            .map(|sess| sess.output_buffer.clone())
            .ok_or_else(|| format!("No session with id: {}", session_id))?
    };

    let mut buffer = buffer.lock().await;
    let chunks = buffer.drain(..).collect::<Vec<_>>();
    Ok(chunks)
}

pub async fn drain_status(
    session_id: &str,
    registry: Arc<Mutex<SessionRegistry>>,
) -> Result<Vec<SshStatusEvent>, String> {
    let buffer = {
        let reg = registry.lock().await;
        reg.sessions
            .get(session_id)
            .map(|sess| sess.status_buffer.clone())
            .ok_or_else(|| format!("No session with id: {}", session_id))?
    };

    let mut buffer = buffer.lock().await;
    Ok(buffer.drain(..).collect())
}
