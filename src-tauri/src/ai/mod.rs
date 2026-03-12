use serde::{Deserialize, Serialize};
use crate::app::ProviderKind;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Ollama,
    OpenAI,
    Anthropic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: AiProvider,
    pub model: String,
    pub ollama_base_url: String,
    pub api_key: Option<String>,
    pub max_context_tokens: usize,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: AiProvider::Ollama,
            model: "llama3".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            api_key: None,
            max_context_tokens: 8192,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[allow(dead_code)]
impl AiProvider {
    pub fn from_profile_kind(kind: &ProviderKind) -> Self {
        match kind {
            ProviderKind::Anthropic => AiProvider::Anthropic,
            ProviderKind::OpenAI
            | ProviderKind::Gemini
            | ProviderKind::MiniMax
            | ProviderKind::Glm
            | ProviderKind::DeepSeek
            | ProviderKind::Qwen
            | ProviderKind::Kimi => AiProvider::OpenAI,
            ProviderKind::Ollama => AiProvider::Ollama,
        }
    }
}

pub async fn chat(config: &AiConfig, messages: Vec<ChatMessage>) -> Result<String, String> {
    match config.provider {
        AiProvider::Ollama => chat_ollama(config, messages).await,
        AiProvider::OpenAI => chat_openai(config, messages).await,
        AiProvider::Anthropic => chat_anthropic(config, messages).await,
    }
}

pub async fn chat_stream(
    config: &AiConfig,
    messages: Vec<ChatMessage>,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    match config.provider {
        AiProvider::Ollama => chat_ollama_stream(config, messages, on_chunk).await,
        AiProvider::OpenAI => chat_openai_stream(config, messages, on_chunk).await,
        AiProvider::Anthropic => chat_anthropic_stream(config, messages, on_chunk).await,
    }
}

fn resolve_provider_base_url(config: &AiConfig, fallback: &str) -> String {
    let value = config.ollama_base_url.trim();
    if value.is_empty() {
        return fallback.to_string();
    }
    value.trim_end_matches('/').to_string()
}

/// List locally available Ollama models
pub async fn list_ollama_models(ollama_base_url: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/tags", ollama_base_url);

    #[derive(Deserialize)]
    struct Model { name: String }
    #[derive(Deserialize)]
    struct ModelsResponse { models: Vec<Model> }

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|_| "Ollama not running. Start it with 'ollama serve'.".to_string())?
        .json::<ModelsResponse>()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.models.into_iter().map(|m| m.name).collect())
}

async fn chat_ollama(config: &AiConfig, messages: Vec<ChatMessage>) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/chat", config.ollama_base_url);

    #[derive(Serialize)]
    struct OllamaRequest<'a> {
        model: &'a str,
        messages: Vec<ChatMessage>,
        stream: bool,
    }

    #[derive(Deserialize)]
    struct OllamaMessage { content: String }
    #[derive(Deserialize)]
    struct OllamaResponse { message: OllamaMessage }

    let body = OllamaRequest {
        model: &config.model,
        messages,
        stream: false,
    };

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?
        .json::<OllamaResponse>()
        .await
        .map_err(|e| format!("Ollama response parse failed: {}", e))?;

    Ok(response.message.content)
}

async fn chat_ollama_stream(
    config: &AiConfig,
    messages: Vec<ChatMessage>,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/chat", config.ollama_base_url);

    #[derive(Serialize)]
    struct OllamaRequest<'a> {
        model: &'a str,
        messages: Vec<ChatMessage>,
        stream: bool,
    }

    #[derive(Deserialize)]
    struct OllamaMessage {
        content: String,
    }
    #[derive(Deserialize)]
    struct OllamaResponse {
        message: OllamaMessage,
    }

    let body = OllamaRequest {
        model: &config.model,
        messages,
        stream: true,
    };

    let mut response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    while let Ok(Some(chunk)) = response.chunk().await {
        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            for line in text.lines() {
                if let Ok(json) = serde_json::from_str::<OllamaResponse>(line) {
                    let _ = on_chunk.send(json.message.content);
                }
            }
        }
    }

    Ok(())
}

// OpenAI API implementation
async fn chat_openai(config: &AiConfig, messages: Vec<ChatMessage>) -> Result<String, String> {
    let api_key = config.api_key.as_ref()
        .ok_or("OpenAI API key is required")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    #[derive(Serialize)]
    struct OpenAIRequest {
        model: String,
        messages: Vec<ChatMessage>,
        max_tokens: Option<usize>,
        temperature: f32,
    }

    #[derive(Deserialize)]
    struct OpenAIChoice {
        message: ChatMessage,
    }

    #[derive(Deserialize)]
    struct OpenAIResponse {
        choices: Vec<OpenAIChoice>,
    }

    let body = OpenAIRequest {
        model: config.model.clone(),
        messages,
        max_tokens: Some(config.max_context_tokens / 2), // Reserve half for response
        temperature: 0.7,
    };

    let base_url = resolve_provider_base_url(config, "https://api.openai.com/v1");
    let endpoint = format!("{}/chat/completions", base_url);
    let response = client
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", error_text));
    }

    let openai_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| format!("OpenAI response parse failed: {}", e))?;

    openai_response.choices
        .first()
        .map(|choice| choice.message.content.clone())
        .ok_or("No response from OpenAI".to_string())
}

async fn chat_openai_stream(
    config: &AiConfig,
    messages: Vec<ChatMessage>,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    let api_key = config.api_key.as_ref()
        .ok_or("OpenAI API key is required")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    #[derive(Serialize)]
    struct OpenAIRequest {
        model: String,
        messages: Vec<ChatMessage>,
        max_tokens: Option<usize>,
        temperature: f32,
        stream: bool,
    }

    #[derive(Deserialize)]
    struct OpenAIDelta {
        content: Option<String>,
    }

    #[derive(Deserialize)]
    struct OpenAIChoice {
        delta: OpenAIDelta,
    }

    #[derive(Deserialize)]
    struct OpenAIStreamResponse {
        choices: Vec<OpenAIChoice>,
    }

    let body = OpenAIRequest {
        model: config.model.clone(),
        messages,
        max_tokens: Some(config.max_context_tokens / 2),
        temperature: 0.7,
        stream: true,
    };

    let base_url = resolve_provider_base_url(config, "https://api.openai.com/v1");
    let endpoint = format!("{}/chat/completions", base_url);
    let mut response = client
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    while let Ok(Some(chunk)) = response.chunk().await {
        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            for line in text.lines() {
                if line.starts_with("data: ") {
                    let json_str = &line[6..]; // Remove "data: " prefix
                    if json_str == "[DONE]" {
                        break;
                    }
                    if let Ok(stream_response) = serde_json::from_str::<OpenAIStreamResponse>(json_str) {
                        if let Some(choice) = stream_response.choices.first() {
                            if let Some(content) = &choice.delta.content {
                                let _ = on_chunk.send(content.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

// Anthropic Claude API implementation
async fn chat_anthropic(config: &AiConfig, messages: Vec<ChatMessage>) -> Result<String, String> {
    let api_key = config.api_key.as_ref()
        .ok_or("Anthropic API key is required")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    // Convert messages to Anthropic format
    let mut system_message = String::new();
    let mut anthropic_messages = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_message = msg.content;
        } else {
            anthropic_messages.push(msg);
        }
    }

    #[derive(Serialize)]
    struct AnthropicRequest {
        model: String,
        max_tokens: usize,
        messages: Vec<ChatMessage>,
        #[serde(skip_serializing_if = "String::is_empty")]
        system: String,
    }

    #[derive(Deserialize)]
    struct AnthropicContent {
        text: String,
    }

    #[derive(Deserialize)]
    struct AnthropicResponse {
        content: Vec<AnthropicContent>,
    }

    let body = AnthropicRequest {
        model: config.model.clone(),
        max_tokens: config.max_context_tokens / 2,
        messages: anthropic_messages,
        system: system_message,
    };

    let base_url = resolve_provider_base_url(config, "https://api.anthropic.com");
    let endpoint = format!("{}/v1/messages", base_url);
    let response = client
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error: {}", error_text));
    }

    let anthropic_response: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Anthropic response parse failed: {}", e))?;

    anthropic_response.content
        .first()
        .map(|content| content.text.clone())
        .ok_or("No response from Anthropic".to_string())
}

async fn chat_anthropic_stream(
    config: &AiConfig,
    messages: Vec<ChatMessage>,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    let api_key = config.api_key.as_ref()
        .ok_or("Anthropic API key is required")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    // Convert messages to Anthropic format
    let mut system_message = String::new();
    let mut anthropic_messages = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_message = msg.content;
        } else {
            anthropic_messages.push(msg);
        }
    }

    #[derive(Serialize)]
    struct AnthropicRequest {
        model: String,
        max_tokens: usize,
        messages: Vec<ChatMessage>,
        #[serde(skip_serializing_if = "String::is_empty")]
        system: String,
        stream: bool,
    }

    #[derive(Deserialize)]
    struct AnthropicDelta {
        text: Option<String>,
    }

    #[derive(Deserialize)]
    struct AnthropicStreamResponse {
        #[serde(rename = "type")]
        event_type: String,
        delta: Option<AnthropicDelta>,
    }

    let body = AnthropicRequest {
        model: config.model.clone(),
        max_tokens: config.max_context_tokens / 2,
        messages: anthropic_messages,
        system: system_message,
        stream: true,
    };

    let base_url = resolve_provider_base_url(config, "https://api.anthropic.com");
    let endpoint = format!("{}/v1/messages", base_url);
    let mut response = client
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    while let Ok(Some(chunk)) = response.chunk().await {
        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            for line in text.lines() {
                if line.starts_with("data: ") {
                    let json_str = &line[6..]; // Remove "data: " prefix
                    if let Ok(stream_response) = serde_json::from_str::<AnthropicStreamResponse>(json_str) {
                        if stream_response.event_type == "content_block_delta" {
                            if let Some(delta) = stream_response.delta {
                                if let Some(text) = delta.text {
                                    let _ = on_chunk.send(text);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// RAG context from terminal scrollback
#[allow(dead_code)]
pub mod rag {
    use super::ChatMessage;

    pub struct ScrollbackContext {
        pub lines: Vec<String>,
        pub max_lines: usize,
    }

    impl ScrollbackContext {
        pub fn new(max_lines: usize) -> Self {
            Self { lines: vec![], max_lines }
        }

        pub fn push_line(&mut self, line: String) {
            if self.lines.len() >= self.max_lines {
                self.lines.remove(0);
            }
            self.lines.push(line);
        }

        pub fn as_system_prompt(&self) -> ChatMessage {
            let context = self.lines.join("\n");
            ChatMessage {
                role: "system".to_string(),
                content: format!(
                    "You are VibeShell AI, an expert terminal assistant. \
                     The user's current terminal scrollback buffer:\n\n```\n{}\n```\n\n\
                     Be concise, accurate, and actionable.",
                    context
                ),
            }
        }
    }
}
