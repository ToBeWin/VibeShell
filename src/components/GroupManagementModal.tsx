import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, GripVertical, X } from 'lucide-react';
import { ServerGroup } from '../hooks/useServerGroups';

interface GroupManagementModalProps {
  groups: ServerGroup[];
  onSaveGroup: (group: ServerGroup) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onReorderGroups: (groupIds: string[]) => Promise<void>;
  onClose: () => void;
}

export function GroupManagementModal({
  groups,
  onSaveGroup,
  onDeleteGroup,
  onReorderGroups: _onReorderGroups,
  onClose,
}: GroupManagementModalProps) {
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('');

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    const newGroup: ServerGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      icon: newGroupIcon || undefined,
      collapsed: false,
      order: groups.length,
      server_ids: [],
      created_at: Date.now(),
    };

    await onSaveGroup(newGroup);
    setNewGroupName('');
    setNewGroupIcon('');
  };

  const handleUpdateGroup = async (group: ServerGroup) => {
    await onSaveGroup(group);
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm('确定要删除这个分组吗？分组中的服务器不会被删除。')) {
      await onDeleteGroup(id);
    }
  };

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
        className="w-[500px] max-h-[600px] bg-[#0D0D14] border border-white/10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">管理分组</h2>
            <p className="text-sm text-gray-500 mt-1">创建、编辑和组织服务器分组</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-all"
            >
              <GripVertical size={14} className="text-gray-600 cursor-move" />
              <div className="flex-1 min-w-0">
                {editingGroup?.id === group.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingGroup.icon || ''}
                      onChange={(e) => setEditingGroup({ ...editingGroup, icon: e.target.value })}
                      placeholder="图标"
                      className="w-16 px-2 py-1 bg-[#06060C] border border-white/10 rounded text-xs text-white"
                    />
                    <input
                      type="text"
                      value={editingGroup.name}
                      onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                      placeholder="分组名称"
                      className="flex-1 px-2 py-1 bg-[#06060C] border border-white/10 rounded text-xs text-white"
                    />
                    <button
                      onClick={() => handleUpdateGroup(editingGroup)}
                      className="px-3 py-1 bg-violet-600 text-white text-xs rounded hover:bg-violet-500"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingGroup(null)}
                      className="px-3 py-1 bg-white/5 text-gray-400 text-xs rounded hover:bg-white/10"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {group.icon && <span className="text-base">{group.icon}</span>}
                    <span className="text-sm text-white font-medium">{group.name}</span>
                    <span className="text-xs text-gray-600">({group.server_ids.length})</span>
                  </div>
                )}
              </div>
              {!editingGroup && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingGroup(group)}
                    className="p-1.5 text-gray-600 hover:text-white hover:bg-white/10 rounded transition-all"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create New Group */}
        <div className="px-7 pb-7 border-t border-white/5 pt-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupIcon}
              onChange={(e) => setNewGroupIcon(e.target.value)}
              placeholder="图标 (emoji)"
              className="w-20 px-3 py-2.5 bg-[#06060C] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              placeholder="新分组名称"
              className="flex-1 px-3 py-2.5 bg-[#06060C] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              className="px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
