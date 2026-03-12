import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Eye, EyeOff, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProviderProfile, ProviderKind } from '../lib/domain';
import { listOllamaModels, startOllamaService } from '../lib/tauri';

interface AiProviderSettingsProps {
  onClose: () => void;
  providerProfiles?: ProviderProfile[];
}

type AiProvider = 'ollama' | 'openai' | 'anthropic';

interface AiConfig {
  provider: AiProvider;
  model: string;
  ollamaBaseUrl: string;
  apiKey?: string;
  maxContextTokens: number;
}

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  transport: AiProvider;
  baseUrl: string;
  models: string[];
  allowPresetModels: boolean;
}

const DEFAULT_MODEL_BY_KIND: Record<ProviderKind, string[]> = {
  ollama: ['llama3', 'llama3:70b', 'codellama', 'mistral', 'phi3'],
  openai: [],
  anthropic: [],
  gemini: [],
  minimax: [],
  glm: [],
  deepseek: [],
  qwen: [],
  kimi: [],
};

const iconByKind: Record<ProviderKind, string> = {
  ollama: '🦙',
  openai: '🤖',
  anthropic: '🧠',
  gemini: '✨',
  minimax: '⚡',
  glm: '🧬',
  deepseek: '🔍',
  qwen: '🌊',
  kimi: '🌙',
};

const transportByKind = (kind: ProviderKind): AiProvider => {
  if (kind === 'ollama') return 'ollama';
  if (kind === 'anthropic') return 'anthropic';
  return 'openai';
};

export function AiProviderSettings({ onClose, providerProfiles = [] }: AiProviderSettingsProps) {
  const { t } = useTranslation();
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
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const canSave = !saving && Boolean(config.model.trim());

  useEffect(() => {
    let cancelled = false;

    const loadOllamaModels = async () => {
      try {
        const models = await listOllamaModels(config.ollamaBaseUrl);
        if (!cancelled) {
          setOllamaModels(models);
        }
        return;
      } catch {}

      try {
        const models = await startOllamaService(config.ollamaBaseUrl);
        if (!cancelled) {
          setOllamaModels(models);
        }
      } catch {
        if (!cancelled) {
          setOllamaModels([]);
        }
      }
    };

    if (config.provider === 'ollama') {
      loadOllamaModels();
    }

    return () => {
      cancelled = true;
    };
  }, [config.provider, config.ollamaBaseUrl]);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('aiConfig', JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('ai-config-updated', { detail: config }));
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

  const fallbackProviderOptions: ProviderOption[] = [
    {
      id: 'ollama',
      name: 'Ollama',
      description: t('aiProviderSettings.description.ollama'),
      icon: iconByKind.ollama,
      transport: 'ollama',
      baseUrl: 'http://localhost:11434',
      models: DEFAULT_MODEL_BY_KIND.ollama,
      allowPresetModels: true,
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: t('aiProviderSettings.description.openai'),
      icon: iconByKind.openai,
      transport: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      models: DEFAULT_MODEL_BY_KIND.openai,
      allowPresetModels: false,
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: t('aiProviderSettings.description.anthropic'),
      icon: iconByKind.anthropic,
      transport: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      models: DEFAULT_MODEL_BY_KIND.anthropic,
      allowPresetModels: false,
    },
  ];

  const providerOptions: ProviderOption[] = useMemo(() => (providerProfiles.length > 0
    ? providerProfiles.map((profile) => ({
      id: profile.id,
      name: profile.label,
      description: t(`aiProviderSettings.description.${profile.kind}`, { defaultValue: t('aiProviderSettings.description.custom') }),
      icon: iconByKind[profile.kind] ?? '🤖',
      transport: transportByKind(profile.kind),
      baseUrl: profile.baseUrl,
      models: profile.kind === 'ollama'
        ? ollamaModels
        : DEFAULT_MODEL_BY_KIND[profile.kind] ?? [],
      allowPresetModels: profile.kind === 'ollama',
    }))
    : fallbackProviderOptions.map((provider) => (
      provider.transport === 'ollama'
        ? { ...provider, models: ollamaModels }
        : provider
    ))), [fallbackProviderOptions, ollamaModels, providerProfiles, t]);

  const selectedProvider = providerOptions.find(
    p => p.transport === config.provider && p.baseUrl === config.ollamaBaseUrl
  ) ?? providerOptions.find(
    p => p.transport === config.provider
  );

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
              <h2 className="text-lg font-semibold text-white">{t('aiProviderSettings.title')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('aiProviderSettings.subtitle')}</p>
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
              {t('aiProviderSettings.providerLabel')}
            </label>
            <div className="grid gap-3">
              {providerOptions.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setConfig(prev => ({ 
                    ...prev, 
                    provider: provider.transport,
                    model: provider.allowPresetModels ? (prev.provider === provider.transport && prev.ollamaBaseUrl === provider.baseUrl ? prev.model : (provider.models[0] ?? '')) : '',
                    ollamaBaseUrl: provider.baseUrl,
                  }))}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedProvider?.id === provider.id
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
                    {selectedProvider?.id === provider.id && (
                      <Check size={20} className="text-violet-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          {selectedProvider && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('aiProviderSettings.modelLabel')}
              </label>
              {selectedProvider.allowPresetModels && selectedProvider.models.length > 0 && (
                <select
                  value={selectedProvider.models.includes(config.model) ? config.model : ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#06060C] border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                >
                  {!selectedProvider.models.includes(config.model) && (
                    <option value="">
                      {t('aiProviderSettings.customModelPlaceholder')}
                    </option>
                  )}
                  {selectedProvider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                placeholder={t('aiProviderSettings.customModelPlaceholder')}
                className="w-full px-4 py-3 bg-[#06060C] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          {/* Ollama Base URL */}
          {config.provider === 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('aiProviderSettings.ollamaUrlLabel')}
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

          {(config.provider === 'openai' || config.provider === 'anthropic') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('aiProviderSettings.apiBaseUrlLabel')}
              </label>
              <input
                type="text"
                value={config.ollamaBaseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, ollamaBaseUrl: e.target.value }))}
                placeholder={config.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
                className="w-full px-4 py-3 bg-[#06060C] border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
              {config.provider === 'openai' && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('aiProviderSettings.apiBaseUrlHint')}
                </p>
              )}
            </div>
          )}

          {/* API Key */}
          {(config.provider === 'openai' || config.provider === 'anthropic') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('aiProviderSettings.apiKeyLabel')}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={t('aiProviderSettings.apiKeyPlaceholder', { provider: selectedProvider?.name ?? 'API' })}
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
                {config.provider === 'openai' && t('aiProviderSettings.apiKeyHintOpenai')}
                {config.provider === 'anthropic' && t('aiProviderSettings.apiKeyHintAnthropic')}
              </p>
            </div>
          )}

          {/* Max Context Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('aiProviderSettings.maxContextLabel')}
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
              {t('aiProviderSettings.maxContextHint')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 pb-7 border-t border-white/5 pt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            {t('aiProviderSettings.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('aiProviderSettings.saving')}
              </>
            ) : (
              t('aiProviderSettings.save')
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
