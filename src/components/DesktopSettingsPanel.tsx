import React, { useEffect, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import type { AppLocale, UpdateChannel } from '../i18n/locales';
import type { DesktopStatus } from '../platform/desktop';
import { MonitorSmartphone, RefreshCw } from 'lucide-react';

export const DesktopSettingsPanel: React.FC = () => {
  const {
    locale,
    setLocale,
    t,
    updateChannel,
    setUpdateChannel,
    closeToTray,
    setCloseToTray,
    diagnosticsEnabled,
    setDiagnosticsEnabled,
    telemetryEnabled,
    setTelemetryEnabled,
  } = useLocale();
  const [isTauri, setIsTauri] = useState(false);
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [agentHost, setAgentHost] = useState('192.168.1.150');
  const [agentPort, setAgentPort] = useState(8080);

  const refresh = async () => {
    try {
      const { isTauri: check } = await import('@tauri-apps/api/core');
      if (!check()) {
        setIsTauri(false);
        return;
      }
      setIsTauri(true);
      const { getDesktopStatus, setCloseToTrayPreference } = await import('../platform/desktop');
      const next = await getDesktopStatus();
      setStatus(next);
      await setCloseToTrayPreference(closeToTray);
    } catch {
      setIsTauri(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAppAutostart = async (enabled: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const { setAppAutostart, getDesktopStatus } = await import('../platform/desktop');
      await setAppAutostart(enabled);
      setStatus(await getDesktopStatus());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleAgentAutostart = async (enabled: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const { setPcAgentAutostart, getDesktopStatus } = await import('../platform/desktop');
      await setPcAgentAutostart(enabled, agentHost.trim() || '192.168.1.150', agentPort);
      setStatus(await getDesktopStatus());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportDiagnostics = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { exportDiagnosticsZipWithDialog } = await import('../platform/diagnostics');
      const path = await exportDiagnosticsZipWithDialog();
      setMessage(`${t('desktop.diagnosticsExportOk')} ${path}`);
      void import('../platform/telemetry').then(m => m.trackTelemetry({ name: 'diag_export', ok: true }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      void import('../platform/telemetry').then(m => m.trackTelemetry({ name: 'diag_export', ok: false }));
    } finally {
      setBusy(false);
    }
  };

  const syncBoards = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { syncCommunityBoardProfiles } = await import('../platform/boardSync');
      const meta = await syncCommunityBoardProfiles();
      const suffix = meta.remote ? '' : ` ${t('desktop.boardSyncBundled')}`;
      setMessage(`${t('desktop.boardSyncOk')} ${meta.count}${suffix}`);
      void import('../platform/telemetry').then(m =>
        m.trackTelemetry({ name: 'board_sync', ok: true }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      void import('../platform/telemetry').then(m =>
        m.trackTelemetry({ name: 'board_sync', ok: false }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
          <MonitorSmartphone className="ui-icon-sm text-cyan-400" aria-hidden="true" />
          {t('desktop.title')}
        </h3>
        <span className="ui-type-micro font-mono text-cyan-400">v0.2.8</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t('desktop.language')}</span>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value as AppLocale)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
          >
            <option value="pl">{t('locale.pl')}</option>
            <option value="en">{t('locale.en')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t('desktop.channel')}</span>
          <select
            value={updateChannel}
            onChange={e => setUpdateChannel(e.target.value as UpdateChannel)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
          >
            <option value="stable">{t('update.channel.stable')}</option>
            <option value="beta">{t('update.channel.beta')}</option>
          </select>
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
        <span className="text-slate-300">{t('desktop.closeToTray')}</span>
        <input
          type="checkbox"
          checked={closeToTray}
          onChange={e => setCloseToTray(e.target.checked)}
          className="accent-cyan-400"
        />
      </label>

      <div className="flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
        <label className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-300">{t('desktop.diagnostics')}</span>
          <input
            type="checkbox"
            checked={diagnosticsEnabled}
            onChange={e => setDiagnosticsEnabled(e.target.checked)}
            className="accent-cyan-400"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          {diagnosticsEnabled && isTauri && (
            <button
              type="button"
              onClick={() => {
                void import('../platform/diagnostics').then(m => m.openDiagnosticsFolder());
              }}
              className="self-start ui-type-micro text-cyan-400 hover:text-cyan-300"
            >
              {t('desktop.diagnosticsOpen')}
            </button>
          )}
          {isTauri && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void exportDiagnostics()}
              className="self-start ui-type-micro text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
            >
              {t('desktop.diagnosticsExport')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
        <label className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-300">{t('desktop.telemetry')}</span>
          <input
            type="checkbox"
            checked={telemetryEnabled}
            onChange={e => setTelemetryEnabled(e.target.checked)}
            className="accent-cyan-400"
          />
        </label>
        <p className="ui-type-micro text-slate-500 leading-relaxed">{t('desktop.telemetryHint')}</p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void syncBoards()}
        className="inline-flex items-center justify-center gap-1.5 self-start px-2.5 py-1.5 rounded-lg ui-type-micro bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-50"
      >
        {t('desktop.boardSync')}
      </button>

      {!isTauri ? (
        <p className="ui-type-micro text-slate-500 leading-relaxed">{t('desktop.hint')}</p>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3 text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
            <span className="text-slate-300">{t('desktop.autostartApp')}</span>
            <input
              type="checkbox"
              disabled={busy}
              checked={!!status?.appAutostart}
              onChange={e => void toggleAppAutostart(e.target.checked)}
              className="accent-cyan-400"
            />
          </label>

          <div className="flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-300">{t('desktop.autostartAgent')}</span>
              <input
                type="checkbox"
                disabled={busy}
                checked={!!status?.agentAutostart}
                onChange={e => void toggleAgentAutostart(e.target.checked)}
                className="accent-cyan-400"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={agentHost}
                onChange={e => setAgentHost(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 ui-type-micro font-mono text-slate-100"
                placeholder="192.168.1.150"
              />
              <input
                type="number"
                value={agentPort}
                onChange={e => setAgentPort(Number(e.target.value) || 8080)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 ui-type-micro font-mono text-slate-100"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="inline-flex items-center justify-center gap-1.5 self-start px-2.5 py-1.5 rounded-lg ui-type-micro bg-slate-800 border border-slate-700 text-slate-200"
          >
            <RefreshCw className={`ui-icon-sm ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('desktop.refresh')}
          </button>

          {message && <p className="ui-type-micro font-mono text-amber-300">{message}</p>}
          <p className="ui-type-micro text-slate-500 leading-relaxed">
            {status?.hint || t('desktop.hint')}
          </p>
        </>
      )}

      {!isTauri && message && <p className="ui-type-micro font-mono text-amber-300">{message}</p>}
    </div>
  );
};
