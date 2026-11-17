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
  Plus,
  ExternalLink,
  Cpu,
  Github,
  Trash2,
} from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import type { AppLocale } from '../i18n/locales';
import type { AutomationRule, Screen, UIWidget } from '../types';
import {
  BUNDLED_MARKETPLACE_CATALOG,
  applyMarketplaceBoardPack,
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
  type MarketplaceKind,
  type MarketplacePack,
} from '../platform/marketplace';
import {
  addUserMarketplaceOption,
  isAllowedGithubAddonUrl,
  mergeCatalogWithUserOptions,
  normalizeGithubRepoUrl,
  removeUserMarketplaceOption,
} from '../platform/marketplaceOptions';

interface MarketplaceViewProps {
  screens: Screen[];
  setScreens: React.Dispatch<React.SetStateAction<Screen[]>>;
  activeScreenIndex: number;
  automations: AutomationRule[];
  setAutomations: React.Dispatch<React.SetStateAction<AutomationRule[]>>;
}

type CatalogFilter = 'all' | MarketplaceKind;

function entryTitle(entry: MarketplaceCatalogEntry, locale: AppLocale): string {
  return locale === 'en' && entry.titleEn ? entry.titleEn : entry.title;
}

function entryDesc(entry: MarketplaceCatalogEntry, locale: AppLocale): string {
  return locale === 'en' && entry.descriptionEn ? entry.descriptionEn : entry.description;
}

function KindIcon({ kind }: { kind: MarketplaceKind }) {
  if (kind === 'widget_pack') return <Layers className="w-4 h-4" aria-hidden="true" />;
  if (kind === 'rule_pack') return <Zap className="w-4 h-4" aria-hidden="true" />;
  if (kind === 'board_pack') return <Cpu className="w-4 h-4" aria-hidden="true" />;
  return <Github className="w-4 h-4" aria-hidden="true" />;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  screens,
  setScreens,
  activeScreenIndex,
  automations,
  setAutomations,
}) => {
  const { t, locale } = useLocale();
  const [catalog, setCatalog] = useState<MarketplaceCatalog>(() =>
    mergeCatalogWithUserOptions(BUNDLED_MARKETPLACE_CATALOG),
  );
  const [remote, setRemote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addKind, setAddKind] = useState<'github_addon' | 'board_pack'>('github_addon');
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addAuthor, setAddAuthor] = useState('');
  const [addRepoUrl, setAddRepoUrl] = useState('');
  const [boardLabel, setBoardLabel] = useState('');
  const [boardVid, setBoardVid] = useState('');
  const [boardPid, setBoardPid] = useState('');
  const [boardChip, setBoardChip] = useState('esp32');
  const [boardOffset, setBoardOffset] = useState('0x1000');
  const [boardBaud, setBoardBaud] = useState('921600');

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadTrustedPublishersFromJson();
      const { catalog: next, remote: isRemote } = await fetchMarketplaceCatalog();
      setCatalog(mergeCatalogWithUserOptions(next));
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

    if (pack.kind === 'rule_pack') {
      const existing = new Set(automations.map(r => r.id));
      const rules = sandboxImportRules(pack, existing);
      setAutomations(prev => [...prev, ...rules]);
      setMessage(t('market.importedRules').replace('{n}', String(rules.length)));
      return;
    }

    const n = applyMarketplaceBoardPack(pack);
    setMessage(t('market.importedBoards').replace('{n}', String(n)));
  };

  const openGithubAddon = (entry: MarketplaceCatalogEntry) => {
    const url = entry.repoUrl ? normalizeGithubRepoUrl(entry.repoUrl) : null;
    if (!url || !isAllowedGithubAddonUrl(url)) {
      setError(t('market.err.badRepo'));
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setMessage(t('market.openedRepo'));
  };

  const installEntry = async (entry: MarketplaceCatalogEntry) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (entry.kind === 'github_addon') {
        openGithubAddon(entry);
        return;
      }
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
      title: screen.name || t('market.defaultWidgetPack'),
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
      title: t('market.defaultRulePack'),
      author: 'local',
    });
    downloadJson(`${pack.id}.json`, pack);
    setMessage(t('market.exportedRules'));
  };

  const submitAddOption = () => {
    setError(null);
    setMessage(null);
    if (addKind === 'github_addon') {
      const result = addUserMarketplaceOption({
        kind: 'github_addon',
        title: addTitle,
        description: addDescription,
        author: addAuthor || 'local',
        repoUrl: addRepoUrl,
        tags: ['github', 'user'],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } else {
      const baud = Number.parseInt(boardBaud, 10);
      const idSlug = `user-board-${Date.now().toString(36)}`;
      const result = addUserMarketplaceOption({
        kind: 'board_pack',
        title: addTitle || boardLabel || t('market.defaultBoardPack'),
        description: addDescription || t('market.addBoardDescFallback'),
        author: addAuthor || 'local',
        tags: ['board', 'user'],
        profiles: [
          {
            id: idSlug,
            label: boardLabel || addTitle || idSlug,
            vid: boardVid.trim().toLowerCase(),
            pid: boardPid.trim().toLowerCase(),
            chip: boardChip.trim().toLowerCase(),
            offset: boardOffset.trim(),
            baud: Number.isFinite(baud) ? baud : 921600,
            boardProfile: boardChip.trim().toLowerCase(),
          },
        ],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
    }
    setCatalog(mergeCatalogWithUserOptions(catalog));
    setMessage(t('market.optionAdded'));
    setAddTitle('');
    setAddDescription('');
    setAddAuthor('');
    setAddRepoUrl('');
    setBoardLabel('');
    setBoardVid('');
    setBoardPid('');
    setShowAdd(false);
  };

  const removeOption = (id: string) => {
    if (!removeUserMarketplaceOption(id)) return;
    setCatalog(mergeCatalogWithUserOptions({
      ...catalog,
      entries: catalog.entries.filter(e => e.id !== id),
    }));
    setMessage(t('market.optionRemoved'));
  };

  const actionLabel = (entry: MarketplaceCatalogEntry) => {
    if (entry.kind === 'widget_pack') return t('market.addToScreen');
    if (entry.kind === 'rule_pack') return t('market.addRules');
    if (entry.kind === 'board_pack') return t('market.addBoards');
    return t('market.openRepo');
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
          <button
            type="button"
            onClick={() => setShowAdd(v => !v)}
            className="ui-btn-icon hover:bg-slate-800 text-slate-300 gap-1.5 px-3"
          >
            <Plus className="ui-icon-sm" aria-hidden="true" />
            {t('market.addOption')}
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

      {showAdd && (
        <section className="border border-slate-800 rounded-lg p-4 space-y-3 bg-slate-950/40">
          <h3 className="ui-type-body text-slate-200 font-medium flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            {t('market.addOptionTitle')}
          </h3>
          <p className="ui-type-micro text-slate-500">{t('market.addOptionHint')}</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['github_addon', 'market.kindGithub'],
                ['board_pack', 'market.kindBoards'],
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAddKind(id)}
                className={`ui-type-micro px-3 py-1.5 rounded-md border transition-colors ${
                  addKind === id
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="ui-type-micro text-slate-500">{t('market.fieldTitle')}</span>
              <input
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
              />
            </label>
            <label className="space-y-1">
              <span className="ui-type-micro text-slate-500">{t('market.fieldAuthor')}</span>
              <input
                value={addAuthor}
                onChange={e => setAddAuthor(e.target.value)}
                className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="ui-type-micro text-slate-500">{t('market.fieldDescription')}</span>
              <textarea
                value={addDescription}
                onChange={e => setAddDescription(e.target.value)}
                rows={2}
                className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
              />
            </label>
            {addKind === 'github_addon' ? (
              <label className="space-y-1 sm:col-span-2">
                <span className="ui-type-micro text-slate-500">{t('market.fieldRepo')}</span>
                <input
                  value={addRepoUrl}
                  onChange={e => setAddRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
                />
              </label>
            ) : (
              <>
                <label className="space-y-1">
                  <span className="ui-type-micro text-slate-500">{t('market.fieldBoardLabel')}</span>
                  <input
                    value={boardLabel}
                    onChange={e => setBoardLabel(e.target.value)}
                    className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
                  />
                </label>
                <label className="space-y-1">
                  <span className="ui-type-micro text-slate-500">{t('market.fieldChip')}</span>
                  <input
                    value={boardChip}
                    onChange={e => setBoardChip(e.target.value)}
                    className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="ui-type-micro text-slate-500">VID</span>
                  <input
                    value={boardVid}
                    onChange={e => setBoardVid(e.target.value)}
                    placeholder="10c4"
                    className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="ui-type-micro text-slate-500">PID</span>
                  <input
                    value={boardPid}
                    onChange={e => setBoardPid(e.target.value)}
                    placeholder="ea60"
                    className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="ui-type-micro text-slate-500">{t('market.fieldOffset')}</span>
                  <input
                    value={boardOffset}
                    onChange={e => setBoardOffset(e.target.value)}
                    className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="ui-type-micro text-slate-500">{t('market.fieldBaud')}</span>
                  <input
                    value={boardBaud}
                    onChange={e => setBoardBaud(e.target.value)}
                    className="w-full ui-type-micro rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
                  />
                </label>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={submitAddOption}
            className="inline-flex items-center justify-center gap-1.5 ui-type-micro font-medium px-3 py-2 rounded-md bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/30"
          >
            <Plus className="ui-icon-sm" aria-hidden="true" />
            {t('market.saveOption')}
          </button>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'market.filterAll'],
            ['widget_pack', 'market.filterWidgets'],
            ['rule_pack', 'market.filterRules'],
            ['board_pack', 'market.filterBoards'],
            ['github_addon', 'market.filterGithub'],
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
                <KindIcon kind={entry.kind} />
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
              {entry.userAdded && (
                <span className="ui-type-micro px-1.5 py-0.5 rounded border border-violet-800/60 text-violet-300/90">
                  {t('market.userAdded')}
                </span>
              )}
              {typeof entry.stars === 'number' && entry.stars > 0 && (
                <span className="ui-type-micro px-1.5 py-0.5 rounded border border-slate-800 text-slate-500 font-mono">
                  ★ {entry.stars}
                </span>
              )}
            </div>
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void installEntry(entry)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 ui-type-micro font-medium px-3 py-2 rounded-md bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/30 disabled:opacity-50"
              >
                {entry.kind === 'github_addon' ? (
                  <ExternalLink className="ui-icon-sm" aria-hidden="true" />
                ) : (
                  <Package className="ui-icon-sm" aria-hidden="true" />
                )}
                {actionLabel(entry)}
              </button>
              {entry.userAdded && (
                <button
                  type="button"
                  onClick={() => removeOption(entry.id)}
                  className="inline-flex items-center justify-center ui-type-micro px-2.5 py-2 rounded-md border border-slate-800 text-slate-400 hover:text-amber-200 hover:border-amber-700/50"
                  aria-label={t('market.removeOption')}
                  title={t('market.removeOption')}
                >
                  <Trash2 className="ui-icon-sm" aria-hidden="true" />
                </button>
              )}
            </div>
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
