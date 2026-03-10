import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, ChevronDown, Cpu, FolderOpen, Globe, Pencil, Plus, 
  Settings, Terminal as TerminalIcon, Trash2, FolderCog
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { ServerConfig } from '../lib/tauri';
import { useServerGroups } from '../hooks/useServerGroups';
import { ServerContextMenu } from './ServerContextMenu';
import { GroupManagementModal } from './GroupManagementModal';

export interface LocalServer extends ServerConfig {
  connected: boolean;
}

interface WorkspaceSidebarV2Props {
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

export function WorkspaceSidebarV2({
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
}: WorkspaceSidebarV2Props) {
  const { t, i18n } = useTranslation();
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Search servers..."]');
        if (input) {
          input.focus();
          input.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Group servers by group
  const serversByGroup = groups.reduce((acc, group) => {
    acc[group.id] = servers.filter(s => group.server_ids.includes(s.id));
    return acc;
  }, {} as Record<string, LocalServer[]>);

  // Ungrouped servers
  const ungroupedServers = servers.filter(s => 
    !groups.some(g => g.server_ids.includes(s.id))
  );

  // Filter servers by search query
  const filteredServers = (serverList: LocalServer[]) => {
    if (!searchQuery) return serverList;
    const query = searchQuery.toLowerCase();
    return serverList.filter(s => 
      s.name.toLowerCase().includes(query) ||
      s.host.toLowerCase().includes(query) ||
      s.user.toLowerCase().includes(query)
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
      // 找到目标分组名称
      const targetGroup = groups.find(g => g.id === groupId);
      if (targetGroup) {
        // 这里可以添加 toast 通知，但需要从 App.tsx 传递 toast 函数
        console.log(`Server moved to ${targetGroup.name}`);
      }
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

  const handleDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleDrop = async (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    const serverId = e.dataTransfer.getData('serverId');
    if (serverId) {
      await handleMoveToGroup(groupId, serverId);
    }
    setDragOverGroupId(null);
  };

  return (
    <motion.aside
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -260, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      className="w-[252px] shrink-0 bg-[#08080E]/95 backdrop-blur-3xl border-r border-white/[0.04] flex flex-col shadow-[4px_0_30px_rgba(0,0,0,0.4)]"
    >
      {/* Header */}
      <div className="h-14 flex items-center px-5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.35)]">
          <TerminalIcon size={16} className="text-white" />
        </div>
        <span className="ml-2.5 font-semibold tracking-wide text-white">{t('app.title')}</span>
        <span className="ml-auto text-[10px] text-violet-300/70 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/15">
          {t('app.version')}
        </span>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search servers..."
            className="w-full px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-gray-600 bg-white/[0.03] border border-white/[0.08] rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Server Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {/* Groups Header with Management Button */}
        <div className="flex items-center justify-between px-2 py-1.5 mb-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-700">
            Server Groups
          </div>
          <button
            onClick={() => setShowGroupManagement(true)}
            className="p-1 text-gray-600 hover:text-gray-400 hover:bg-white/[0.05] rounded transition-all"
            title="管理分组"
          >
            <FolderCog size={12} />
          </button>
        </div>

        {groups.map(group => {
          const groupServers = filteredServers(serversByGroup[group.id] || []);
          if (searchQuery && groupServers.length === 0) return null;

          return (
            <div key={group.id} className="mb-2">
              {/* Group Header */}
              <button
                onClick={() => toggleGroupCollapsed(group.id)}
                onDragOver={(e) => handleDragOver(e, group.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, group.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors rounded-lg ${
                  dragOverGroupId === group.id
                    ? 'bg-violet-500/20 border-2 border-violet-500/50 text-violet-300'
                    : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.02] border-2 border-transparent'
                }`}
              >
                {group.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {group.icon && <span>{group.icon}</span>}
                <span>{group.name}</span>
                <span className="ml-auto text-[10px] text-gray-700">{groupServers.length}</span>
              </button>

              {/* Group Servers */}
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

        {/* Ungrouped Servers */}
        {ungroupedServers.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-700">
              Other
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

        {/* Add Server Button */}
        <button
          onClick={onAddServer}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-600 hover:text-gray-300 text-[13px] transition-all rounded-xl hover:bg-white/[0.04] border border-dashed border-white/[0.06] mt-2 group"
        >
          <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" /> 
          {t('sidebar.addServer')}
        </button>
      </div>

      {/* Bottom Actions */}
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
          <FolderOpen size={15} className={sftpOpen ? 'text-violet-400' : ''} /> 
          {t('sidebar.sftpBrowser')}
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
      
      {/* Context Menu */}
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

      {/* Group Management Modal */}
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

// Server Item Component
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
      className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 mb-0.5 cursor-move ${
        isActive
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
        {isActive && <ChevronRight size={13} className="text-violet-400 shrink-0" />}
      </div>
    </div>
  );
}
