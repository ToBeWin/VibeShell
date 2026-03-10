import { Server, Trash2, Edit, Clock } from 'lucide-react';
import { SavedConnection } from '../hooks/useConnectionManager';
import { useState } from 'react';

interface ConnectionListProps {
  connections: SavedConnection[];
  loading: boolean;
  onConnect: (connection: SavedConnection) => void;
  onEdit: (connection: SavedConnection) => void;
  onDelete: (id: string) => void;
}

export function ConnectionList({
  connections,
  loading,
  onConnect,
  onEdit,
  onDelete,
}: ConnectionListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const formatLastUsed = (timestamp: number) => {
    if (timestamp === 0) return 'Never';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-8">
        <Server size={48} className="mx-auto mb-4 text-gray-600" />
        <p className="text-sm text-gray-400">No saved connections</p>
        <p className="text-xs text-gray-600 mt-2">Create a new connection to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connections.map((connection) => (
        <div
          key={connection.id}
          className="group relative rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-all"
        >
          <button
            onClick={() => onConnect(connection)}
            className="w-full text-left p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1 truncate">
                  {connection.name}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                  {connection.user}@{connection.host}:{connection.port}
                </p>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500">
                  <Clock size={10} />
                  <span>{formatLastUsed(connection.last_used)}</span>
                </div>
              </div>
              <Server size={16} className="text-violet-400 shrink-0 ml-3" />
            </div>
          </button>

          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(connection);
              }}
              className="p-1.5 rounded-md bg-black/50 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Edit connection"
            >
              <Edit size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(connection.id);
              }}
              className={`p-1.5 rounded-md transition-colors ${
                deleteConfirm === connection.id
                  ? 'bg-red-500 text-white'
                  : 'bg-black/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400'
              }`}
              title={deleteConfirm === connection.id ? 'Click again to confirm' : 'Delete connection'}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
