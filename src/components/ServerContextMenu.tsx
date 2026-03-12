import { motion } from 'framer-motion';
import { Star, Rocket, Wrench, FolderPlus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ServerContextMenuProps {
  x: number;
  y: number;
  serverId: string;
  currentGroupId?: string;
  groups: Array<{ id: string; name: string; icon?: string }>;
  onMoveToGroup: (groupId: string, serverId: string) => void;
  onClose: () => void;
}

const groupIcons: Record<string, any> = {
  'favorites': Star,
  'production': Rocket,
  'development': Wrench,
};

export function ServerContextMenu({
  x,
  y,
  serverId,
  currentGroupId,
  groups,
  onMoveToGroup,
  onClose,
}: ServerContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 w-48 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
      style={{ left: x, top: y, background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
    >
      <div className="py-1">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">
          {t('serverMenu.moveToGroup')}
        </div>
        {groups.map(group => {
          const Icon = groupIcons[group.id] || FolderPlus;
          const isCurrentGroup = group.id === currentGroupId;
          
          return (
            <button
              key={group.id}
              onClick={() => {
                if (!isCurrentGroup) {
                  onMoveToGroup(group.id, serverId);
                }
                onClose();
              }}
              disabled={isCurrentGroup}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                isCurrentGroup
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {group.icon ? (
                <span className="text-base">{group.icon}</span>
              ) : (
                <Icon size={14} />
              )}
              <span>{group.name}</span>
              {isCurrentGroup && (
                <span className="ml-auto text-[10px] text-violet-400">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
