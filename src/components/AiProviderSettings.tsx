import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Eye, EyeOff, X, Check } from 'lucide-react';

interface AiProviderSettingsProps {
  onClose: () => void;
}

type AiProvider = 'ollama' | 'openai' | 'anthropic';

interface AiConfig {
  provider: AiProvider;
  model: string;
  ollamaBaseUrl: string;
  apiKey?: string;
  maxContextTokens: number;
}

export function AiProviderSettings({ onClose }: AiProviderSettingsProps) {
  const [config, setConfig] = useState<AiConfig>(() => {
    const saved = localStorage.getItem('aiConfig');
    return saved ? JSON.parse(saved) : {
      provider: 'ollama' as AiProvider,
      model: 'llama3',
      ollamaBaseUrl: 'http://localhost:11434',
      apiKey: '',
      maxContextTokens: 8192,
    };
  });
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('aiConfig', JSON.stringify(config));
      // Here you could also call a Tauri command to save to backend
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to save AI config:', error);
      setSaving(false);
    }
  };

  const providerOptions = [
    {
      id: 'ollama' as AiProvider,
      name: 'Ollama',
      description: '本地运行的开源模型',
      icon: '🦙',
      models: ['llama3', 'llama3:70b', 'codellama', 'mistral', 'phi3'],
    },
    {
      id: 'openai' as AiProvider,
      name: 'OpenAI',
      description: 'GPT-4, GPT-3.5 等商业模型',
      icon: '🤖',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
    },
    {
      id: 'anthropic' as AiProvider,
      name: 'Anthropic',
      description: 'Claude 系列模型',
      icon: '🧠',
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    },
  ];

  const selectedProvider = providerOptions.find(p => p.id === config.provider);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="w-[600px] max-h-[700px] bg-[#0D0D14] border border-white/10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Settings size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI 提供商设置</h2>
              <p className="text-sm text-gray-500 mt-1">配置 AI 模型和 API 密钥</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              选择 AI 提供商
            </label>
            <div className="grid gap-3">
              {providerOptions.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setConfig(prev => ({ 
                    ...prev, 
                    provider: provider.id,
                    model: provider.models[0] // Reset to first model
                  }))}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    config.provider === provider.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-white">{provider.name}</div>
                      <div className="text-sm text-gray-400 mt-1">{provider.description}</div>
                    </div>
                    {config.provider === provider.id && (
                      <Check size={20} className="text-violet-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          {selectedProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                选择模型
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-4 py-3 bg-[#06060C] border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
              >
                {selectedProvider.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ollama Base URL */}
          {config.provider === 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ollama 服务器地址
              </label>
              <input
                type="text"
                value={config.ollamaBaseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, ollamaBaseUrl: e.target.value }))}
                placeholder="http://localhost:11434"
                className="w-full px-4 py-3 bg-[#06060C] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          {/* API Key */}
          {(config.provider === 'openai' || config.provider === 'anthropic') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API 密钥
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={`输入 ${selectedProvider?.name} API 密钥`}
                  className="w-full px-4 py-3 pr-12 bg-[#06060C] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {config.provider === 'openai' && '从 https://platform.openai.com/api-keys 获取'}
                {config.provider === 'anthropic' && '从 https://console.anthropic.com/ 获取'}
              </p>
            </div>
          )}

          {/* Max Context Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              最大上下文长度
            </label>
            <input
              type="number"
              value={config.maxContextTokens}
              onChange={(e) => setConfig(prev => ({ ...prev, maxContextTokens: parseInt(e.target.value) || 8192 }))}
              min="1024"
              max="128000"
              step="1024"
              className="w-full px-4 py-3 bg-[#06060C] border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              控制 AI 可以处理的上下文长度，影响对话记忆和响应质量
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 pb-7 border-t border-white/5 pt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </>
            ) : (
              '保存设置'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}