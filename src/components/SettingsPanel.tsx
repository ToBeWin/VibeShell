import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, Globe, ShieldCheck, Cpu, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HostKeyRecord, ProviderProfile } from '../lib/domain';
import { listAiProviderProfiles, listKnownHostKeys, listOllamaModels, removeKnownHostKey } from '../lib/tauri';
import { AiProviderSettings } from './AiProviderSettings';

interface SettingsPanelProps {
  onClose: () => void;
}

type Tab = 'appearance' | 'ai' | 'security';

const TAB_CLASSES = (active: boolean) =>
  `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
    active ? 'bg-violet-500/15 text-violet-300 border border-violet-400/20' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'
  }`;

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('appearance');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [knownHosts, setKnownHosts] = useState<HostKeyRecord[]>([]);
  const [probing, setProbing] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'midnight' | 'ocean'>('dark');
  const [showAiProviderSettings, setShowAiProviderSettings] = useState(false);

  const probeOllama = async () => {
    setProbing(true);
    try {
      const models = await listOllamaModels(ollamaUrl);
      setOllamaModels(models);
    } catch {
      setOllamaModels([]);
    } finally { setProbing(false); }
  };

  useEffect(() => {
    probeOllama();
    listAiProviderProfiles().then(setProviders).catch(() => setProviders([]));
    listKnownHostKeys().then(setKnownHosts).catch(() => setKnownHosts([]));
  }, []);

  const handleRemoveKnownHost = async (record: HostKeyRecord) => {
    if (!confirm(`Remove trusted host key for ${record.host}?`)) return;
    await removeKnownHostKey(record.host, record.key_base64);
    setKnownHosts(prev => prev.filter(item => !(item.host === record.host && item.key_base64 === record.key_base64)));
  };

  const themes: { id: 'dark' | 'midnight' | 'ocean'; label: string; bg: string; accent: string }[] = [
    { id: 'dark',     label: 'Vibe Dark',    bg: '#0E0E11', accent: '#7C3AED' },
    { id: 'midnight', label: 'Midnight',      bg: '#01050E', accent: '#3B82F6' },
    { id: 'ocean',    label: 'Ocean',         bg: '#031018', accent: '#06B6D4' },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="w-[720px] h-[480px] bg-[#0D0D14] border border-white/10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden flex"
        >
          {/* Left nav */}
          <div className="w-48 border-r border-white/[0.05] flex flex-col p-4 gap-1 bg-white/[0.01] shrink-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-700 px-4 py-2">{t('settings.title')}</p>
            {([
              { id: 'appearance' as Tab, icon: <Palette size={15}/>, label: t('settings.appearance') },
              { id: 'ai'         as Tab, icon: <Cpu size={15}/>,     label: t('settings.ai') },
              { id: 'security'   as Tab, icon: <ShieldCheck size={15}/>, label: t('settings.security') },
            ]).map(item => (
              <button key={item.id} onClick={() => setTab(item.id)} className={TAB_CLASSES(tab === item.id)}>
                {item.icon} {item.label}
              </button>
            ))}
            <div className="mt-auto">
              <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:text-white hover:bg-white/5 transition-all w-full text-left"
              >
                <Globe size={15}/> {i18n.language === 'en' ? '中文' : 'English'}
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-6">
              <h2 className="text-lg font-semibold text-white capitalize">{tab}</h2>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-colors">
                <X size={18}/>
              </button>
            </div>

            <div className="px-8 pb-8 space-y-8">
              {/* ── Appearance Tab ─── */}
              {tab === 'appearance' && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">{t('settings.theme')}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {themes.map(th => (
                        <button
                          key={th.id}
                          onClick={() => setTheme(th.id)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                            theme === th.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="w-full h-14 rounded-xl flex items-center justify-center" style={{ background: th.bg, border: `1px solid ${th.accent}30` }}>
                            <div className="w-1.5 h-5 rounded-full" style={{ background: th.accent, boxShadow: `0 0 12px ${th.accent}` }}/>
                          </div>
                          <span className="text-xs font-medium text-gray-300">{th.label}</span>
                          {theme === th.id && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]"/>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{t('settings.font')}</p>
                    <select className="w-full bg-[#0A0A12] border border-white/10 text-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 transition-colors">
                      {['JetBrains Mono', 'Cascadia Code', 'Fira Code', 'SF Mono', 'Menlo'].map(f => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* ── AI Tab ─── */}
              {tab === 'ai' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">AI 提供商配置</p>
                      <button
                        onClick={() => setShowAiProviderSettings(true)}
                        className="px-3 py-1.5 rounded-lg text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                      >
                        配置提供商
                      </button>
                    </div>
                    <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                          <Cpu size={16} className="text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">多提供商支持</p>
                          <p className="text-xs text-gray-500">支持 Ollama、OpenAI、Anthropic</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 leading-relaxed">
                        VibeShell 支持多种 AI 提供商，包括本地 Ollama 模型和云端 API。点击"配置提供商"按钮设置您的首选 AI 服务。
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">{t('settings.ollamaEndpoint')}</p>
                    <div className="flex gap-2">
                      <input
                        value={ollamaUrl}
                        onChange={e => setOllamaUrl(e.target.value)}
                        className="flex-1 bg-[#0A0A12] border border-white/10 text-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-500/40 transition-colors"
                      />
                      <button onClick={probeOllama} disabled={probing}
                        className="px-4 py-2.5 rounded-xl text-sm text-white bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 transition-all">
                        {probing ? '…' : t('settings.probe')}
                      </button>
                    </div>
                    {ollamaModels.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ollamaModels.map(m => (
                          <span key={m} className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-1 rounded-lg font-mono">{m}</span>
                        ))}
                      </div>
                    )}
                    {ollamaModels.length === 0 && !probing && (
                      <div className="mt-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-xs text-yellow-500">
                        {t('settings.ollamaOffline')}{' '}
                        <a href="https://ollama.ai" target="_blank" rel="noopener" className="underline inline-flex items-center gap-1">ollama.ai <ExternalLink size={10}/></a>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl space-y-2">
                    <p className="text-xs font-semibold text-gray-400">{t('settings.privacyTitle')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('settings.privacyBody')}</p>
                  </div>
                  {providers.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Providers</p>
                      <div className="grid grid-cols-2 gap-2">
                        {providers.map(provider => (
                          <div key={provider.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-gray-200">{provider.label}</span>
                              <span className="text-[10px] uppercase tracking-wide text-gray-500">{provider.region}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              {provider.requiresApiKey ? 'API key' : 'Local'} · {provider.supportsStream ? 'Stream' : 'Sync'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Security Tab ─── */}
              {tab === 'security' && (
                <div className="space-y-4">
                  {[
                    { icon: '🔑', title: t('settings.sec.keychain'), body: t('settings.sec.keychainBody') },
                    { icon: '🛡️', title: t('settings.sec.noCloud'),  body: t('settings.sec.noCloudBody') },
                    { icon: '📡', title: t('settings.sec.nodelay'),   body: t('settings.sec.nodelayBody') },
                  ].map(({ icon, title, body }) => (
                    <div key={title} className="flex gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{body}</p>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                    <p className="text-sm font-semibold text-white">Known Hosts</p>
                    <p className="text-xs text-gray-500 mt-1 mb-4">Trusted SSH/SFTP host keys saved by VibeShell.</p>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {knownHosts.length === 0 && (
                        <div className="text-xs text-gray-600 py-3">No trusted hosts saved yet.</div>
                      )}
                      {knownHosts.map((record) => (
                        <div key={`${record.host}:${record.key_base64}`} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-gray-200 font-mono break-all">{record.host}</div>
                              <div className="mt-1 text-[11px] text-gray-500">{record.algorithm}</div>
                              <div className="mt-1 text-[11px] text-gray-400 font-mono break-all">{record.fingerprint}</div>
                            </div>
                            <button
                              onClick={() => handleRemoveKnownHost(record)}
                              className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* AI Provider Settings Modal */}
      <AnimatePresence>
        {showAiProviderSettings && (
          <AiProviderSettings onClose={() => setShowAiProviderSettings(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
