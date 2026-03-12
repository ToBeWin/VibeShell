import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  FolderCog,
  FolderOpen,
  Github,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ServerConfig, openExternalUrl } from '../lib/tauri';
import { useServerGroups } from '../hooks/useServerGroups';
import { BrandMark } from './BrandMark';
import { ServerContextMenu } from './ServerContextMenu';
import { GroupManagementModal } from './GroupManagementModal';

export interface LocalServer extends ServerConfig {
  connected: boolean;
}

function getServerMonogram(name: string) {
  const parts = name.split(/[\s-_]+/).filter(Boolean);
  const monogram = parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
  return monogram || name.slice(0, 1).toUpperCase() || '?';
}

interface WorkspaceSidebarV2Props {
  servers: LocalServer[];
  activeServer: LocalServer;
  aiOpen: boolean;
  sftpOpen: boolean;
  aiOnline: boolean;
  collapsed: boolean;
  onSelectServer: (server: LocalServer) => void;
  onAddServer: () => void;
  onEditServer: (server: LocalServer) => void;
  onDeleteServer: (server: LocalServer) => void;
  onToggleAi: () => void;
  onToggleSftp: () => void;
  onToggleZenMode: () => void;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceSidebarV2({
  servers,
  activeServer,
  aiOpen,
  sftpOpen,
  aiOnline,
  collapsed,
  onSelectServer,
  onAddServer,
  onEditServer,
  onDeleteServer,
  onToggleAi,
  onToggleSftp,
  onToggleZenMode,
  onToggleCollapse,
  onOpenSettings,
}: WorkspaceSidebarV2Props) {
  const { t } = useTranslation();
  const { groups, toggleGroupCollapsed, addServerToGroup, saveGroup, deleteGroup, reorderGroups } = useServerGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    serverId: string;
    currentGroupId?: string;
  } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [showGroupManagement, setShowGroupManagement] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[data-sidebar-search="true"]');
        if (input) {
          input.focus();
          input.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const serversByGroup = groups.reduce((acc, group) => {
    acc[group.id] = servers.filter(s => group.server_ids.includes(s.id));
    return acc;
  }, {} as Record<string, LocalServer[]>);

  const ungroupedServers = servers.filter(s => !groups.some(g => g.server_ids.includes(s.id)));

  const filteredServers = (serverList: LocalServer[]) => {
    if (!searchQuery) return serverList;
    const query = searchQuery.toLowerCase();
    return serverList.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.host.toLowerCase().includes(query) ||
      s.user.toLowerCase().includes(query),
    );
  };

  const handleContextMenu = (e: React.MouseEvent, serverId: string, groupId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      serverId,
      currentGroupId: groupId,
    });
  };

  const handleMoveToGroup = async (groupId: string, serverId: string) => {
    try {
      await addServerToGroup(groupId, serverId);
    } catch (error) {
      console.error('Failed to move server to group:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, serverId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('serverId', serverId);
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  };

  const handleDrop = async (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    const serverId = e.dataTransfer.getData('serverId');
    if (serverId) {
      await handleMoveToGroup(groupId, serverId);
    }
    setDragOverGroupId(null);
  };

  const handleOpenGitHub = () => {
    void openExternalUrl('https://github.com/ToBeWin/VibeShell');
  };

  const collapsedServers = filteredServers(servers).slice(0, 8);

  return (
    <motion.aside
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -260, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      className={`flex shrink-0 flex-col border-r shadow-[8px_0_40px_rgba(0,0,0,0.35)] backdrop-blur-3xl ${collapsed ? 'w-[68px]' : 'w-[268px]'}`}
      style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--panel-bg) 92%, black), color-mix(in srgb, var(--panel-bg) 84%, black))', borderColor: 'var(--panel-border)' }}
    >
      {collapsed ? (
        <>
          <div className="relative flex h-16 shrink-0 items-center justify-center">
            <BrandMark compact />
            <button
              onClick={onToggleCollapse}
              title={t('sidebar.expandSidebar')}
              className="absolute right-1 top-5 rounded-lg p-1.5 text-gray-600 transition-all hover:bg-white/[0.05] hover:text-gray-300"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-2 py-2">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <div className="space-y-2">
                {collapsedServers.map(server => (
                  <button
                    key={server.id}
                    type="button"
                    title={`${server.name} · ${server.user}@${server.host}`}
                    onClick={() => onSelectServer(server)}
                    onContextMenu={(e) => handleContextMenu(e, server.id)}
                    className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                      activeServer.id === server.id
                        ? 'border-cyan-300/22 bg-cyan-400/[0.09] text-white shadow-[0_8px_20px_rgba(34,211,238,0.08)]'
                        : 'border-white/[0.03] bg-white/[0.015] text-gray-400 hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-gray-200'
                    }`}
                  >
                    <span className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${server.connected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-700'}`} />
                    <span className="text-[10px] font-semibold tracking-[0.06em] text-white/90">
                      {getServerMonogram(server.name)}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={onAddServer}
                title={t('sidebar.addServer')}
                className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-cyan-300/14 bg-cyan-400/[0.03] text-gray-500 transition-all hover:border-cyan-300/24 hover:bg-cyan-400/[0.08] hover:text-gray-200"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/[0.05] px-2 py-3">
            <RailButton active={aiOpen} title={t('sidebar.aiAssistant')} onClick={onToggleAi}>
              <Cpu size={16} className={aiOpen ? 'text-cyan-300' : ''} />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" style={{ opacity: aiOnline ? 1 : 0.45 }} />
            </RailButton>
            <RailButton active={sftpOpen} title={t('sidebar.sftpBrowser')} onClick={onToggleSftp}>
              <FolderOpen size={16} className={sftpOpen ? 'text-cyan-300' : ''} />
            </RailButton>
            <RailButton title={t('sidebar.zenMode')} onClick={onToggleZenMode}>
              <Monitor size={16} />
            </RailButton>

            <div className="mt-2 space-y-2 border-t border-white/[0.05] pt-2">
              <RailIconButton title={t('sidebar.github')} onClick={handleOpenGitHub}>
                <Github size={16} />
              </RailIconButton>
              <RailIconButton title={t('sidebar.settings')} onClick={onOpenSettings}>
                <Settings size={16} />
              </RailIconButton>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-16 shrink-0 items-center px-5">
            <BrandMark />
            <div className="ml-3 min-w-0">
              <div className="font-semibold tracking-[0.01em] text-white">{t('app.title')}</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500">{t('sidebar.shellSubtitle')}</div>
            </div>
            <span className="ml-auto rounded-full border border-cyan-300/12 bg-cyan-400/[0.05] px-2.5 py-1 text-[10px] text-cyan-100/80">
              {t('app.version')}
            </span>
            <button
              onClick={onToggleCollapse}
              title={t('sidebar.collapseSidebar')}
              className="ml-2 rounded-lg p-1.5 text-gray-600 transition-all hover:bg-white/[0.05] hover:text-gray-300"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-sidebar-search="true"
                placeholder={t('sidebar.search') ?? 'Search servers...'}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-cyan-300/30 focus:outline-none"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1 text-[10px] text-gray-600">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 py-1">
            <div className="mb-3 flex shrink-0 items-center justify-between px-2 py-1.5">
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-gray-600">{t('sidebar.servers')}</div>
              <button
                onClick={() => setShowGroupManagement(true)}
                className="rounded-lg p-1.5 text-gray-600 transition-all hover:bg-white/[0.05] hover:text-gray-300"
                title={t('sidebar.manageGroups') ?? 'Manage groups'}
              >
                <FolderCog size={12} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {groups.map(group => {
                const groupServers = filteredServers(serversByGroup[group.id] || []);
                if (searchQuery && groupServers.length === 0) return null;

                return (
                  <div key={group.id} className="mb-2">
                    <button
                      onClick={() => toggleGroupCollapsed(group.id)}
                      onDragOver={(e) => handleDragOver(e, group.id)}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDrop={(e) => handleDrop(e, group.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.24em] transition-colors ${
                        dragOverGroupId === group.id
                          ? 'border-2 border-cyan-300/30 bg-cyan-400/[0.12] text-cyan-100'
                          : 'border-2 border-transparent text-gray-600 hover:bg-white/[0.03] hover:text-gray-300'
                      }`}
                    >
                      {group.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      {group.icon && <span>{group.icon}</span>}
                      <span>{group.name}</span>
                      <span className="ml-auto text-[10px] text-gray-700">{groupServers.length}</span>
                    </button>

                    <AnimatePresence>
                      {!group.collapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          {groupServers.map(server => (
                            <ServerItem
                              key={server.id}
                              server={server}
                              isActive={activeServer.id === server.id}
                              onSelect={onSelectServer}
                              onEdit={onEditServer}
                              onDelete={onDeleteServer}
                              onContextMenu={(e) => handleContextMenu(e, server.id, group.id)}
                              onDragStart={(e) => handleDragStart(e, server.id)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {ungroupedServers.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-gray-700">
                    {t('sidebar.other') ?? 'Other'}
                  </div>
                  {filteredServers(ungroupedServers).map(server => (
                    <ServerItem
                      key={server.id}
                      server={server}
                      isActive={activeServer.id === server.id}
                      onSelect={onSelectServer}
                      onEdit={onEditServer}
                      onDelete={onDeleteServer}
                      onContextMenu={(e) => handleContextMenu(e, server.id)}
                      onDragStart={(e) => handleDragStart(e, server.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onAddServer}
              title={t('sidebar.addServer')}
              className="group mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-cyan-300/12 bg-cyan-400/[0.03] px-3.5 py-3 text-[13px] text-gray-500 transition-all hover:border-cyan-300/22 hover:bg-cyan-400/[0.08] hover:text-gray-200"
            >
              <Plus size={14} className="shrink-0 transition-transform duration-300 group-hover:rotate-90" />
              {t('sidebar.addServer')}
            </button>
          </div>

          <div className="space-y-1 border-t border-white/[0.05] p-4">
            <button
              onClick={onToggleAi}
              title={t('sidebar.aiAssistant')}
              className={`relative flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-[13px] transition-all ${
                aiOpen ? 'border-cyan-300/16 bg-cyan-400/[0.08] text-cyan-100' : 'border-transparent text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'
              }`}
            >
              <Cpu size={15} className={aiOpen ? 'text-cyan-300' : ''} />
              {t('sidebar.aiAssistant')}
              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" style={{ opacity: aiOnline ? 1 : 0.45 }} />
            </button>
            <button
              onClick={onToggleSftp}
              title={t('sidebar.sftpBrowser')}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-[13px] transition-all ${
                sftpOpen ? 'border-cyan-300/16 bg-cyan-400/[0.08] text-cyan-100' : 'border-transparent text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'
              }`}
            >
              <FolderOpen size={15} className={sftpOpen ? 'text-cyan-300' : ''} />
              {t('sidebar.sftpBrowser')}
            </button>
            <button
              onClick={onToggleZenMode}
              title={t('sidebar.zenMode')}
              className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-[13px] text-gray-500 transition-all hover:bg-white/[0.04] hover:text-gray-200"
            >
              <Monitor size={15} />
              {t('sidebar.zenMode')}
            </button>

            <div className="mt-2 space-y-1 border-t border-white/[0.05] pt-2">
              <button
                onClick={handleOpenGitHub}
                title={t('sidebar.github')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-gray-600 transition-all hover:bg-white/[0.04] hover:text-gray-300"
              >
                <Github size={15} />
                {t('sidebar.github')}
              </button>
              <button
                onClick={onOpenSettings}
                title={t('sidebar.settings')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-gray-600 transition-all hover:bg-white/[0.04] hover:text-gray-300"
              >
                <Settings size={15} />
                {t('sidebar.settings')}
              </button>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {contextMenu && (
          <ServerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            serverId={contextMenu.serverId}
            currentGroupId={contextMenu.currentGroupId}
            groups={groups}
            onMoveToGroup={handleMoveToGroup}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupManagement && (
          <GroupManagementModal
            groups={groups}
            onSaveGroup={saveGroup}
            onDeleteGroup={deleteGroup}
            onReorderGroups={reorderGroups}
            onClose={() => setShowGroupManagement(false)}
          />
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

interface RailButtonProps {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function RailButton({ active = false, title, onClick, children }: RailButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
        active ? 'border-cyan-300/16 bg-cyan-400/[0.08] text-cyan-100' : 'border-transparent text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function RailIconButton({ title, onClick, children }: RailButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-white/[0.04] hover:text-gray-300"
    >
      {children}
    </button>
  );
}

interface ServerItemProps {
  server: LocalServer;
  isActive: boolean;
  onSelect: (server: LocalServer) => void;
  onEdit: (server: LocalServer) => void;
  onDelete: (server: LocalServer) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
}

function ServerItem({ server, isActive, onSelect, onEdit, onDelete, onContextMenu, onDragStart }: ServerItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onSelect(server)}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(server);
        }
      }}
      className={`group mb-0.5 flex w-full cursor-move items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
        isActive
          ? 'border-violet-400/15 bg-violet-500/10 text-white'
          : 'border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
      }`}
    >
      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${server.connected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-700'}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{server.name}</div>
        <div className="truncate text-[11px] font-mono text-gray-600">{server.user}@{server.host}</div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          onClick={e => { e.stopPropagation(); onEdit(server); }}
          className="rounded-md p-1 text-gray-600 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(server); }}
          className="rounded-md p-1 text-gray-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
        {isActive && <ChevronRight size={13} className="shrink-0 text-violet-400" />}
      </div>
    </div>
  );
}
