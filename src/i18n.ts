import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "app": {
        "title": "VibeShell",
        "version": "v0.1",
      },
      "sidebar": {
        "servers": "Servers",
        "addServer": "Add Server",
        "aiAssistant": "AI Assistant",
        "zenMode": "Zen Mode",
        "sftpBrowser": "Remote Files",
        "settings": "Preferences"
      },
      "terminal": {
        "newTab": "New Tab",
        "exitZen": "ESC to Exit Zen",
        "zenHint": "⌘ + K Zen Mode"
      },
      "ai": {
        "title": "Vibe AI",
        "localNotice": "Local · Ollama",
        "placeholder": "Ask Ollama... (Enter to send)",
        "thinking": "AI is thinking...",
        "contextConnected": "Context live from terminal (RAG)",
        "contextEmpty": "Waiting for terminal input...",
        "welcome": "Hello! I am VibeShell AI, running locally via Ollama. I am connected to your terminal scrollback buffer (RAG) and can help analyze command outputs. How can I assist you?"
      },
      "modal": {
        "addServer": "Add Server",
        "addServerSub": "Credentials stored securely in OS Keychain.",
        "serverName": "Display Name",
        "host": "Hostname / IP",
        "port": "Port",
        "user": "Username",
        "password": "Password",
        "passwordHint": "Stored in OS Keychain",
        "testConn": "Test",
        "save": "Save Server"
      }
    }
  },
  zh: {
    translation: {
      "app": {
        "title": "VibeShell",
        "version": "v0.1",
      },
      "sidebar": {
        "servers": "服务器",
        "addServer": "添加服务器",
        "aiAssistant": "AI 助手",
        "zenMode": "专注模式",
        "sftpBrowser": "远程文件",
        "settings": "偏好设置"
      },
      "terminal": {
        "newTab": "新标签页",
        "exitZen": "ESC 退出专注模式",
        "zenHint": "⌘ + K 专注模式"
      },
      "ai": {
        "title": "Vibe AI",
        "localNotice": "本地 · Ollama",
        "placeholder": "问 Ollama... (Enter 发送)",
        "thinking": "AI 正在思考...",
        "contextConnected": "上下文已接通终端缓冲区 (RAG)",
        "contextEmpty": "等待终端输入...",
        "welcome": "你好！我是 VibeShell AI，基于 Ollama 在本地运行。我已连接到你的终端滚动缓冲区（RAG），可以帮你分析命令输出。有什么需要帮助的？"
      },
      "modal": {
        "addServer": "添加服务器",
        "addServerSub": "密码已加密存入系统凭据管理器（Keychain）。",
        "serverName": "服务器名称",
        "host": "主机名 / IP",
        "port": "端口",
        "user": "用户名",
        "password": "密码",
        "passwordHint": "存入系统 Keychain",
        "testConn": "测试连接",
        "save": "保存"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default to English
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
