import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HostKeyScanResult } from '../lib/domain';
import { saveServer, saveServerPassword, ServerConfig, sshTestConnection } from '../lib/tauri';
import { LocalServer } from './WorkspaceSidebar';

export function AddServerModal({ initialServer, onClose, onSaved }: {
  initialServer?: LocalServer | null;
  onClose: () => void;
  onSaved: (s: LocalServer, password: string) => void;
}) {
  const { t } = useTranslation();
  const initial = initialServer ?? null;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    host: initial?.host ?? '',
    port: String(initial?.port ?? 22),
    user: initial?.user ?? 'root',
    password: '',
  });
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving]         = useState(false);
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const testConn = async () => {
    setTesting(true); setTestResult(null);
    try {
      const msg = await sshTestConnection(form.host, parseInt(form.port) || 22, form.user);
      setTestResult({ ok: true, msg });
    } catch (e) { setTestResult({ ok: false, msg: String(e) }); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!form.host || !form.user) return;
    setSaving(true);
    const id = initial?.id ?? `srv-${Date.now()}`;
    const cfg: ServerConfig = { id, name: form.name || form.host, host: form.host, port: parseInt(form.port) || 22, user: form.user };
    try {
      await saveServer(cfg);
      if (form.password) await saveServerPassword(id, form.password);
    } catch {}
    onSaved({ ...cfg, connected: false }, form.password);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="w-[420px] bg-[#0D0D14] border border-white/10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="px-7 pt-7 pb-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{initial ? 'Edit Server' : t('modal.addServer')}</h2>
          <p className="text-sm text-gray-500 mt-1">{initial ? 'Update SSH host settings and credentials.' : t('modal.addServerSub')}</p>
        </div>
        <div className="px-7 py-6 space-y-4">
          {[
            { label: t('modal.serverName'), key:'name', placeholder:'prod-api-01', type:'text' },
            { label: t('modal.host'),       key:'host', placeholder:'192.168.1.100', type:'text' },
            { label: t('modal.port'),       key:'port', placeholder:'22', type:'number' },
            { label: t('modal.user'),       key:'user', placeholder:'root', type:'text' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
              <input type={type} value={form[key as keyof typeof form]} onChange={f(key)} placeholder={placeholder}
                className="w-full bg-[#06060C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-2">
              <ShieldCheck size={12} className="text-green-400"/> {t('modal.password')}
              <span className="text-[10px] text-gray-600 ml-auto">{t('modal.passwordHint')}</span>
            </label>
            <input type="password" value={form.password} onChange={f('password')} placeholder="••••••••"
              className="w-full bg-[#06060C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
            />
          </div>
          {testResult && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${testResult.ok ? 'bg-green-900/20 border-green-500/20 text-green-400' : 'bg-red-900/20 border-red-500/20 text-red-400'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </div>
          )}
        </div>
        <div className="px-7 pb-7 flex gap-3">
          <button onClick={testConn} disabled={!form.host || testing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            {testing ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>}
            {t('modal.testConn')}
          </button>
          <button onClick={handleSave} disabled={!form.host || !form.user || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-all shadow-md"
          >
            {saving && <Loader2 size={14} className="animate-spin"/>} {t('modal.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function HostKeyTrustModal({
  scan,
  onApprove,
  onReject,
}: {
  scan: { host: string; port: number; result: HostKeyScanResult };
  onApprove: () => void;
  onReject: () => void;
}) {
  const changed = scan.result.fingerprint_changed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onReject()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="w-[480px] bg-[#0D0D14] border border-white/10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="px-7 pt-7 pb-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">
            {changed ? 'Host Key Changed' : 'Trust Host Key'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {changed
              ? 'The server fingerprint no longer matches the saved record. Connection is blocked until you verify the change.'
              : 'First-time SSH/SFTP connection. Verify the fingerprint before trusting this host.'}
          </p>
        </div>

        <div className="px-7 py-6 space-y-4">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Target</div>
            <div className="text-sm text-gray-200 font-mono">{scan.host}:{scan.port}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Algorithm</div>
            <div className="text-sm text-gray-200 font-mono">{scan.result.record.algorithm}</div>
          </div>
          <div className={`rounded-2xl border p-4 space-y-2 ${changed ? 'border-red-500/20 bg-red-900/10' : 'border-violet-500/20 bg-violet-900/10'}`}>
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Fingerprint</div>
            <div className="text-sm text-white font-mono break-all">{scan.result.record.fingerprint}</div>
          </div>
        </div>

        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          {!changed && (
            <button
              onClick={onApprove}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-md"
            >
              Trust Host
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function NoticeModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="w-[460px] bg-[#0D0D14] border border-white/10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="px-7 pt-7 pb-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="px-7 py-6">
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{message}</p>
        </div>
        <div className="px-7 pb-7">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-md"
          >
            OK
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
