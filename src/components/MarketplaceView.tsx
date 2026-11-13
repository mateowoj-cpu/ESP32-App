import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Upload,
  Store,
  ShieldCheck,
  RefreshCw,
  Package,
  Zap,
  Layers,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import type { AppLocale } from '../i18n/locales';
import type { AutomationRule, Screen, UIWidget } from '../types';
import {
  BUNDLED_MARKETPLACE_CATALOG,
  exportRulePack,
  exportWidgetPack,
  fetchMarketplaceCatalog,
  loadMarketplacePack,
  loadTrustedPublishersFromJson,
  parseMarketplacePackJson,
  sandboxImportRules,
  sandboxImportWidgets,
  type MarketplaceCatalog,
  type MarketplaceCatalogEntry,
  type MarketplacePack,
} from '../platform/marketplace';

interface MarketplaceViewProps {
  screens: Screen[];
  setScreens: React.Dispatch<React.SetStateAction<Screen[]>>;
  activeScreenIndex: number;
  automations: AutomationRule[];
  setAutomations: React.Dispatch<React.SetStateAction<AutomationRule[]>>;
}

function entryTitle(entry: MarketplaceCatalogEntry, locale: AppLocale): string {
  return locale === 'en' && entry.titleEn ? entry.titleEn : entry.title;
}

function entryDesc(entry: MarketplaceCatalogEntry, locale: AppLocale): string {
  return locale === 'en' && entry.descriptionEn ? entry.descriptionEn : entry.description;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  screens,
  setScreens,
  activeScreenIndex,
  automations,
  setAutomations,
}) => {
  const { t, locale } = useLocale();
  const [catalog, setCatalog] = useState<MarketplaceCatalog>(BUNDLED_MARKETPLACE_CATALOG);
  const [remote, setRemote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'widget_pack' | 'rule_pack'>('all');

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadTrustedPublishersFromJson();
      const { catalog: next, remote: isRemote } = await fetchMarketplaceCatalog();
      setCatalog(next);
      setRemote(isRemote);
      setMessage(
        isRemote ? t('market.syncedRemote') : t('market.syncedBundled'),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = useMemo(() => {
    if (filter === 'all') return catalog.entries;
    return catalog.entries.filter(e => e.kind === filter);
  }, [catalog.entries, filter]);

  const applyPack = (pack: MarketplacePack) => {
    if (pack.kind === 'widget_pack') {
      const screen = screens[activeScreenIndex];
      if (!screen) {
        setError(t('market.err.noScreen'));
        return;
      }
      const existing = new Set(screen.widgets.map(w => w.id));
      const widgets = sandboxImportWidgets(pack, existing);
      setScreens(prev =>
        prev.map((s, i) =>
          i === activeScreenIndex
            ? { ...s, widgets: [...s.widgets, ...widgets] }
            : s,
        ),
      );
      setMessage(t('market.importedWidgets').replace('{n}', String(widgets.length)));
      return;
    }

    const existing = new Set(automations.map(r => r.id));
    const rules = sandboxImportRules(pack, existing);
    setAutomations(prev => [...prev, ...rules]);
    setMessage(t('market.importedRules').replace('{n}', String(rules.length)));
  };

  const installEntry = async (entry: MarketplaceCatalogEntry) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await loadMarketplacePack(entry);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyPack(result.pack);
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const result = parseMarketplacePackJson(text);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        applyPack(result.pack);
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setError(t('market.err.read'));
      setBusy(false);
    };
    reader.readAsText(file);
  };

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportActiveWidgets = () => {
    const screen = screens[activeScreenIndex];
    if (!screen || screen.widgets.length === 0) {
      setError(t('market.err.noWidgets'));
      return;
    }
    const pack = exportWidgetPack(screen.widgets as UIWidget[], {
      id: `local-widgets-${Date.now().toString(36)}`,
      title: screen.name || 'Widget pack',
      author: 'local',
    });
    downloadJson(`${pack.id}.json`, pack);
    setMessage(t('market.exportedWidgets'));
  };

  const exportActiveRules = () => {
    if (automations.length === 0) {
      setError(t('market.err.noRules'));
      return;
    }
    const pack = exportRulePack(automations, {
      id: `local-rules-${Date.now().toString(36)}`,
      title: 'Automation rules',
      author: 'local',
    });
    downloadJson(`${pack.id}.json`, pack);
    setMessage(t('market.exportedRules'));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 mb-1">
            <Store className="w-5 h-5" aria-hidden="true" />
            <h2 className="ui-type-title text-white font-semibold tracking-tight">
              {t('market.title')}
            </h2>
          </div>
          <p className="ui-type-body text-slate-400 max-w-2xl">{t('market.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="ui-btn-icon hover:bg-slate-800 text-slate-300 gap-1.5 px-3"
          >
            <RefreshCw className={`ui-icon-sm ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('market.refresh')}
          </button>
          <label className="ui-btn-icon hover:bg-slate-800 text-slate-300 gap-1.5 px-3 cursor-pointer">
            <Upload className="ui-icon-sm" aria-hidden="true" />
            {t('market.importJson')}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="ui-type-micro text-slate-400 leading-relaxed">{t('market.sandboxHint')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'market.filterAll'],
            ['widget_pack', 'market.filterWidgets'],
            ['rule_pack', 'market.filterRules'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`ui-type-micro px-3 py-1.5 rounded-md border transition-colors ${
              filter === id
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(key)}
          </button>
        ))}
        <span className="ui-type-micro text-slate-600 self-center ml-auto font-mono">
          {remote ? t('market.sourceRemote') : t('market.sourceBundled')} · {catalog.entries.length}
        </span>
      </div>

      {(message || error) && (
        <div
          className={`flex items-center gap-2 ui-type-micro px-3 py-2 rounded-md border ${
            error
              ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
              : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
          }`}
          role="status"
        >
          {error ? (
            <AlertTriangle className="ui-icon-sm shrink-0" aria-hidden="true" />
          ) : (
            <Check className="ui-icon-sm shrink-0" aria-hidden="true" />
          )}
          {error || message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(entry => (
          <article
            key={entry.id}
            className="border border-slate-800 bg-slate-950/50 rounded-lg p-4 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                {entry.kind === 'widget_pack' ? (
                  <Layers className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Zap className="w-4 h-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="ui-type-body text-white font-medium truncate">
                  {entryTitle(entry, locale)}
                </h3>
                <p className="ui-type-micro text-slate-500 font-mono truncate">{entry.author}</p>
              </div>
            </div>
            <p className="ui-type-micro text-slate-400 leading-relaxed flex-1">
              {entryDesc(entry, locale)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map(tag => (
                <span
                  key={tag}
                  className="ui-type-micro px-1.5 py-0.5 rounded border border-slate-800 text-slate-500"
                >
                  {tag}
                </span>
              ))}
              {entry.requireSignature && (
                <span className="ui-type-micro px-1.5 py-0.5 rounded border border-emerald-800/60 text-emerald-400/90">
                  {t('market.signed')}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void installEntry(entry)}
              className="mt-auto inline-flex items-center justify-center gap-1.5 ui-type-micro font-medium px-3 py-2 rounded-md bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/30 disabled:opacity-50"
            >
              <Package className="ui-icon-sm" aria-hidden="true" />
              {entry.kind === 'widget_pack'
                ? t('market.addToScreen')
                : t('market.addRules')}
            </button>
          </article>
        ))}
      </div>

      <section className="border border-slate-800 rounded-lg p-4 space-y-3 bg-slate-950/40">
        <h3 className="ui-type-body text-slate-200 font-medium flex items-center gap-2">
          <Download className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          {t('market.exportTitle')}
        </h3>
        <p className="ui-type-micro text-slate-500">{t('market.exportHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportActiveWidgets}
            className="ui-btn-icon hover:bg-slate-800 text-slate-300 gap-1.5 px-3"
          >
            <Layers className="ui-icon-sm" aria-hidden="true" />
            {t('market.exportWidgets')}
          </button>
          <button
            type="button"
            onClick={exportActiveRules}
            className="ui-btn-icon hover:bg-slate-800 text-slate-300 gap-1.5 px-3"
          >
            <Zap className="ui-icon-sm" aria-hidden="true" />
            {t('market.exportRules')}
          </button>
        </div>
      </section>
    </div>
  );
};
