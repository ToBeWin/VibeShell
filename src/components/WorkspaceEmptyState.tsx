import { FolderOpen, Plus, Server, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LocalServer } from './WorkspaceSidebarV2';

interface WorkspaceEmptyStateProps {
  servers: LocalServer[];
  onConnectCurrent: () => void;
  onAddServer: () => void;
  onOpenFiles: () => void;
  onSelectServer: (server: LocalServer) => void;
}

export function WorkspaceEmptyState({
  servers,
  onConnectCurrent,
  onAddServer,
  onOpenFiles,
  onSelectServer,
}: WorkspaceEmptyStateProps) {
  const { t } = useTranslation();
  const recentServers = servers.slice(0, 8);

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-[linear-gradient(180deg,#07080d_0%,#090b11_100%)] px-6 py-4">
      <div className="mx-auto flex min-h-full max-w-5xl items-start">
        <div className="w-full">
          <section className="overflow-hidden rounded-[26px] border px-8 py-7 shadow-[0_18px_56px_rgba(0,0,0,0.34)]" style={{ borderColor: 'var(--panel-border)', background: 'linear-gradient(145deg, color-mix(in srgb, var(--panel-bg) 95%, #081522), color-mix(in srgb, var(--panel-bg) 88%, #0b0d14))' }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ borderColor: 'var(--panel-strong-border)', background: 'var(--panel-accent-bg)', color: 'var(--panel-accent-text)' }}>
              <Sparkles size={12} />
              {t('workspace.launchpad')}
            </div>
            <h2 className="max-w-3xl text-[32px] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-[36px]">
              {t('workspace.headline')}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400">
              {t('workspace.body')}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onConnectCurrent}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                <Server size={16} />
                {t('workspace.connectCurrent')}
              </button>
              <button
                onClick={onAddServer}
                className="inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-sm font-medium text-gray-300 transition hover:text-white"
              >
                <Plus size={16} />
                {t('sidebar.addServer')}
              </button>
              <button
                onClick={onOpenFiles}
                className="inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-sm font-medium text-gray-300 transition hover:text-white"
              >
                <FolderOpen size={16} />
                {t('workspace.openFiles')}
              </button>
            </div>
          </section>

          <section className="mt-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600">{t('workspace.recentTargets')}</div>
            {recentServers.length > 0 ? (
              <div className="-mx-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="flex min-w-max gap-3 px-1">
                {recentServers.map(server => (
                  <button
                    key={server.id}
                    onClick={() => onSelectServer(server)}
                    className="w-[220px] shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:border-cyan-300/16 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${server.connected ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-gray-600'}`} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{server.name}</div>
                        <div className="truncate text-xs font-mono text-gray-500">{server.user}@{server.host}:{server.port}</div>
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-gray-500">
                {t('workspace.noServers')}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
