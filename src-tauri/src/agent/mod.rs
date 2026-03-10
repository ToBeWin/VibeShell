use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentAction {
    ExplainCommand,
    AnalyzeError,
    AnalyzeLogs,
    GenerateShellScript,
    GeneratePythonScript,
    SessionAwareChat,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionContext {
    pub session_id: Option<String>,
    pub pane_id: Option<String>,
    pub host: Option<String>,
    pub user: Option<String>,
    pub cwd: Option<String>,
    pub selected_text: Option<String>,
    pub recent_commands: Vec<String>,
    pub recent_output: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRequest {
    pub action: AgentAction,
    pub user_input: String,
    #[serde(default)]
    pub context: SessionContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub title: String,
    pub summary: String,
    pub suggested_command: Option<String>,
    pub suggested_script: Option<String>,
    pub warnings: Vec<String>,
}

fn build_system_prompt(action: &AgentAction, context: &SessionContext) -> String {
    let action_prompt = match action {
        AgentAction::ExplainCommand => {
            "Explain the command clearly, include risks, expected effects, and safer alternatives when relevant."
        }
        AgentAction::AnalyzeError => {
            "Analyze the error output, identify likely root causes, and propose a short remediation plan."
        }
        AgentAction::AnalyzeLogs => {
            "Analyze the logs, identify likely patterns and root causes, and suggest the next diagnostic steps."
        }
        AgentAction::GenerateShellScript => {
            "Generate a production-usable shell script with comments, safe defaults, and error handling."
        }
        AgentAction::GeneratePythonScript => {
            "Generate a production-usable Python script with comments, argument handling, and error handling."
        }
        AgentAction::SessionAwareChat => {
            "Answer as a terminal-native assistant using the current session context. Be concise and actionable."
        }
    };

    format!(
        "You are VibeShell Agent, an AI-native terminal assistant for developers and operators.\n\
         {}\n\n\
         Current session context:\n\
         - session_id: {:?}\n\
         - pane_id: {:?}\n\
         - host: {:?}\n\
         - user: {:?}\n\
         - cwd: {:?}\n\
         - selected_text: {:?}\n\
         - recent_commands:\n{}\n\
         - recent_output:\n{}\n",
        action_prompt,
        context.session_id,
        context.pane_id,
        context.host,
        context.user,
        context.cwd,
        context.selected_text,
        if context.recent_commands.is_empty() {
            "  (none)".to_string()
        } else {
            context
                .recent_commands
                .iter()
                .map(|line| format!("  - {}", line))
                .collect::<Vec<_>>()
                .join("\n")
        },
        if context.recent_output.is_empty() {
            "  (none)".to_string()
        } else {
            context
                .recent_output
                .iter()
                .map(|line| format!("  {}", line))
                .collect::<Vec<_>>()
                .join("\n")
        }
    )
}

pub fn to_chat_messages(request: &AgentRequest) -> Vec<crate::ai::ChatMessage> {
    vec![
        crate::ai::ChatMessage {
            role: "system".to_string(),
            content: build_system_prompt(&request.action, &request.context),
        },
        crate::ai::ChatMessage {
            role: "user".to_string(),
            content: request.user_input.clone(),
        },
    ]
}

pub fn fallback_response(request: &AgentRequest, content: String) -> AgentResponse {
    let (title, suggested_command, suggested_script) = match request.action {
        AgentAction::ExplainCommand => ("Command Explanation", None, None),
        AgentAction::AnalyzeError => ("Error Analysis", None, None),
        AgentAction::AnalyzeLogs => ("Log Analysis", None, None),
        AgentAction::GenerateShellScript => ("Shell Script", None, Some(content.clone())),
        AgentAction::GeneratePythonScript => ("Python Script", None, Some(content.clone())),
        AgentAction::SessionAwareChat => ("Session Answer", None, None),
    };

    AgentResponse {
        title: title.to_string(),
        summary: content,
        suggested_command,
        suggested_script,
        warnings: vec![],
    }
}
