import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { SavedConnection } from '../hooks/useConnectionManager';

interface ConnectionFormProps {
  connection?: SavedConnection;
  onSave: (connection: SavedConnection) => Promise<void>;
  onCancel: () => void;
}

export function ConnectionForm({ connection, onSave, onCancel }: ConnectionFormProps) {
  const [formData, setFormData] = useState<Partial<SavedConnection>>({
    id: connection?.id || '',
    name: connection?.name || '',
    host: connection?.host || '',
    port: connection?.port || 22,
    user: connection?.user || '',
    password: connection?.password || '',
    private_key: connection?.private_key || '',
    created_at: connection?.created_at || 0,
    last_used: connection?.last_used || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [usePrivateKey, setUsePrivateKey] = useState(!!connection?.private_key);

  useEffect(() => {
    if (connection) {
      setFormData({
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        user: connection.user,
        password: connection.password || '',
        private_key: connection.private_key || '',
        created_at: connection.created_at,
        last_used: connection.last_used,
      });
      setUsePrivateKey(!!connection.private_key);
    }
  }, [connection]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (!formData.host?.trim()) {
      newErrors.host = 'Host is required';
    }

    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }

    if (!formData.user?.trim()) {
      newErrors.user = 'Username is required';
    }

    if (!usePrivateKey && !formData.password?.trim()) {
      newErrors.password = 'Password is required when not using private key';
    }

    if (usePrivateKey && !formData.private_key?.trim()) {
      newErrors.private_key = 'Private key is required when selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: formData.id || '',
        name: formData.name!,
        host: formData.host!,
        port: formData.port!,
        user: formData.user!,
        password: usePrivateKey ? undefined : formData.password,
        private_key: usePrivateKey ? formData.private_key : undefined,
        created_at: formData.created_at || 0,
        last_used: formData.last_used || 0,
      });
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1.5">
          Connection Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
          placeholder="My Server"
        />
        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Host
          </label>
          <input
            type="text"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            placeholder="example.com"
          />
          {errors.host && <p className="text-xs text-red-400 mt-1">{errors.host}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Port
          </label>
          <input
            type="number"
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            placeholder="22"
          />
          {errors.port && <p className="text-xs text-red-400 mt-1">{errors.port}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1.5">
          Username
        </label>
        <input
          type="text"
          value={formData.user}
          onChange={(e) => setFormData({ ...formData, user: e.target.value })}
          className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
          placeholder="root"
        />
        {errors.user && <p className="text-xs text-red-400 mt-1">{errors.user}</p>}
      </div>

      <div className="flex items-center gap-2 py-2">
        <input
          type="checkbox"
          id="usePrivateKey"
          checked={usePrivateKey}
          onChange={(e) => setUsePrivateKey(e.target.checked)}
          className="w-4 h-4 rounded border-white/[0.08] bg-white/[0.05] text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
        />
        <label htmlFor="usePrivateKey" className="text-xs text-gray-300">
          Use private key authentication
        </label>
      </div>

      {!usePrivateKey ? (
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Private Key
          </label>
          <textarea
            value={formData.private_key}
            onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
            className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={4}
          />
          {errors.private_key && <p className="text-xs text-red-400 mt-1">{errors.private_key}</p>}
        </div>
      )}

      {errors.submit && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{errors.submit}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 rounded-lg text-sm font-medium text-white transition-colors"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={14} />
              {connection ? 'Update' : 'Save'} Connection
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] disabled:bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm font-medium text-gray-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </form>
  );
}
