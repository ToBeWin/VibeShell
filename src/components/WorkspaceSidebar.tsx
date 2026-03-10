import { motion } from 'framer-motion';
import { ChevronRight, Cpu, FolderOpen, Globe, Pencil, Plus, Server, Settings, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ServerConfig } from '../lib/tauri';

export interface LocalServer extends ServerConfig {
  connected: boolean;
}

interface WorkspaceSidebarProps {
  servers: LocalServer[];
  activeServer: LocalServer;
  aiOpen: boolean;
  sftpOpen: boolean;
  aiOnline: boolean;
  onSelectServer: (server: LocalServer) => void;
  onAddServer: () => void;
  onEditServer: (server: LocalServer) => void;
  onDeleteServer: (server: LocalServer) => void;
  onToggleAi: () => void;
  onToggleSftp: () => void;
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceSidebar({
  servers,
  activeServer,
  aiOpen,
  sftpOpen,
  aiOnline,
  onSelectServer,
  onAddServer,
  onEditServer,
  onDeleteServer,
  onToggleAi,
  onToggleSftp,
  onToggleLanguage,
  onOpenSettings,
}: WorkspaceSidebarProps) {
  const { t, i18n } = useTranslation();

  return (
    <motion.aside
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -260, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      className="w-[252px] shrink-0 bg-[#08080E]/95 backdrop-blur-3xl border-r border-white/[0.04] flex flex-col shadow-[4px_0_30px_rgba(0,0,0,0.4)]"
    >
      <div className="h-14 flex items-center px-5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.35)]">
          <TerminalIcon size={16} className="text-white" />
        </div>
        <span className="ml-2.5 font-semibold tracking-wide text-white">{t('app.title')}</span>
        <span className="ml-auto text-[10px] text-violet-300/70 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/15">
          {t('app.version')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 px-3 mb-2 flex items-center gap-2">
          <Server size={10} /> {t('sidebar.servers')}
        </p>
        {servers.map(server => (
          <div
            key={server.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectServer(server)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectServer(server);
              }
            }}
            className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 mb-0.5 ${
              activeServer.id === server.id
                ? 'bg-violet-500/10 border border-violet-400/15 text-white'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 border border-transparent'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${server.connected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-700'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{server.name}</div>
              <div className="text-[11px] font-mono text-gray-600 truncate">{server.user}@{server.host}</div>
            </div>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onEditServer(server); }}
                className="rounded-md p-1 text-gray-600 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDeleteServer(server); }}
                className="rounded-md p-1 text-gray-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
              {activeServer.id === server.id && <ChevronRight size={13} className="text-violet-400 shrink-0" />}
            </div>
          </div>
        ))}
        <button
          onClick={onAddServer}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-600 hover:text-gray-300 text-[13px] transition-all rounded-xl hover:bg-white/[0.04] border border-dashed border-white/[0.06] mt-2 group"
        >
          <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" /> {t('sidebar.addServer')}
        </button>
      </div>

      <div className="p-3 border-t border-white/[0.04] space-y-0.5">
        <button
          onClick={onToggleAi}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
            aiOpen ? 'bg-violet-500/10 text-violet-300 border border-violet-400/15' : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          <Cpu size={15} className={aiOpen ? 'text-violet-400' : ''} />
          {t('sidebar.aiAssistant')}
          {aiOnline ? (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
          ) : (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
          )}
        </button>
        <button
          onClick={onToggleSftp}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
            sftpOpen ? 'bg-violet-500/10 text-violet-300 border border-violet-400/15' : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          <FolderOpen size={15} className={sftpOpen ? 'text-violet-400' : ''} /> {t('sidebar.sftpBrowser')}
        </button>
        <div className="border-t border-white/[0.04] pt-1 mt-1 space-y-0.5">
          <button
            onClick={onToggleLanguage}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition-all"
          >
            <Globe size={15} /> {i18n.language === 'en' ? '中文' : 'English'}
          </button>
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition-all"
          >
            <Settings size={15} /> {t('sidebar.settings')}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
