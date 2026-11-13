import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  AppLocale,
  loadLocale,
  saveLocale,
  translate,
  UpdateChannel,
  loadUpdateChannel,
  saveUpdateChannel,
  loadCloseToTray,
  saveCloseToTray,
  loadDiagnosticsEnabled,
  saveDiagnosticsEnabled,
  loadTelemetryEnabled,
  saveTelemetryEnabled,
} from './locales';

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string) => string;
  updateChannel: UpdateChannel;
  setUpdateChannel: (channel: UpdateChannel) => void;
  closeToTray: boolean;
  setCloseToTray: (enabled: boolean) => void;
  diagnosticsEnabled: boolean;
  setDiagnosticsEnabled: (enabled: boolean) => void;
  telemetryEnabled: boolean;
  setTelemetryEnabled: (enabled: boolean) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<AppLocale>(() => loadLocale());
  const [updateChannel, setChannelState] = useState<UpdateChannel>(() => loadUpdateChannel());
  const [closeToTray, setCloseToTrayState] = useState<boolean>(() => loadCloseToTray());
  const [diagnosticsEnabled, setDiagState] = useState<boolean>(() => loadDiagnosticsEnabled());
  const [telemetryEnabled, setTelemetryState] = useState<boolean>(() => loadTelemetryEnabled());

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: next => {
        saveLocale(next);
        setLocaleState(next);
        document.documentElement.lang = next;
      },
      t: key => translate(locale, key),
      updateChannel,
      setUpdateChannel: next => {
        saveUpdateChannel(next);
        setChannelState(next);
      },
      closeToTray,
      setCloseToTray: next => {
        saveCloseToTray(next);
        setCloseToTrayState(next);
        void import('../platform/desktop')
          .then(m => m.setCloseToTrayPreference(next))
          .catch(() => undefined);
      },
      diagnosticsEnabled,
      setDiagnosticsEnabled: next => {
        saveDiagnosticsEnabled(next);
        setDiagState(next);
        void import('../platform/diagnostics')
          .then(m => m.setDiagnosticsEnabledNative(next))
          .catch(() => undefined);
      },
      telemetryEnabled,
      setTelemetryEnabled: next => {
        saveTelemetryEnabled(next);
        setTelemetryState(next);
      },
    }),
    [locale, updateChannel, closeToTray, diagnosticsEnabled, telemetryEnabled],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
