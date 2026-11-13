export type AppLocale = 'pl' | 'en';
export type UpdateChannel = 'stable' | 'beta';

export const UPDATE_ENDPOINTS: Record<UpdateChannel, string[]> = {
  stable: [
    'https://github.com/mateowoj-cpu/ESP32-App/releases/latest/download/latest.json',
  ],
  beta: [
    'https://github.com/mateowoj-cpu/ESP32-App/releases/latest/download/latest-beta.json',
    'https://github.com/mateowoj-cpu/ESP32-App/releases/download/beta-channel/latest.json',
  ],
};

type Dict = Record<string, string>;

const pl: Dict = {
  'nav.simulator': 'Symulator Sprzętowy',
  'nav.editor': 'Edytor Graficzny UI',
  'nav.usb': 'Wykryj ESP32 (USB)',
  'nav.automations': 'Automatyzacje & Zwierzak',
  'nav.integrations': 'Integracje & API',
  'nav.code': 'Generator Kodu C++',
  'nav.settings': 'Ustawienia & Dotyk',
  'brand.sub': 'LCD · OLED · Sensory · C++',
  'action.update': 'Update',
  'action.exportProject': '.esp32studio',
  'action.downloadIno': 'Pobierz .INO',
  'update.available': 'Dostępna aktualizacja',
  'update.upToDate': 'Aplikacja jest aktualna.',
  'update.unavailable': 'Auto-update dostępny tylko w aplikacji desktop (Tauri).',
  'update.install': 'Pobierz i zainstaluj',
  'update.channel.stable': 'Stable',
  'update.channel.beta': 'Beta',
  'desktop.title': 'Desktop (Windows)',
  'desktop.language': 'Język UI',
  'desktop.channel': 'Kanał aktualizacji',
  'desktop.autostartApp': 'Uruchamiaj Studio z Windows',
  'desktop.autostartAgent': 'Autostart agenta PC (Startup)',
  'desktop.closeToTray': 'Zamykaj do zasobnika (tray)',
  'desktop.hint':
    'Tray: Pokaż / Agent Start·Stop / Wyjdź. Autostart wymaga zainstalowanej aplikacji Tauri.',
  'desktop.refresh': 'Odśwież status',
  'locale.pl': 'Polski',
  'locale.en': 'English',
};

const en: Dict = {
  'nav.simulator': 'Hardware Simulator',
  'nav.editor': 'Visual UI Editor',
  'nav.usb': 'Detect ESP32 (USB)',
  'nav.automations': 'Automations & Pet',
  'nav.integrations': 'Integrations & API',
  'nav.code': 'C++ Code Generator',
  'nav.settings': 'Settings & Touch',
  'brand.sub': 'LCD · OLED · Sensors · C++',
  'action.update': 'Update',
  'action.exportProject': '.esp32studio',
  'action.downloadIno': 'Download .INO',
  'update.available': 'Update available',
  'update.upToDate': 'You are up to date.',
  'update.unavailable': 'Auto-update is only available in the desktop (Tauri) app.',
  'update.install': 'Download and install',
  'update.channel.stable': 'Stable',
  'update.channel.beta': 'Beta',
  'desktop.title': 'Desktop (Windows)',
  'desktop.language': 'UI language',
  'desktop.channel': 'Update channel',
  'desktop.autostartApp': 'Launch Studio with Windows',
  'desktop.autostartAgent': 'PC agent Startup shortcut',
  'desktop.closeToTray': 'Close to system tray',
  'desktop.hint':
    'Tray: Show / Agent Start·Stop / Quit. Autostart requires the installed Tauri app.',
  'desktop.refresh': 'Refresh status',
  'locale.pl': 'Polski',
  'locale.en': 'English',
};

const TABLES: Record<AppLocale, Dict> = { pl, en };

export function translate(locale: AppLocale, key: string): string {
  return TABLES[locale][key] ?? TABLES.pl[key] ?? key;
}

export function loadLocale(): AppLocale {
  const raw = localStorage.getItem('esp32_locale');
  return raw === 'en' ? 'en' : 'pl';
}

export function saveLocale(locale: AppLocale): void {
  localStorage.setItem('esp32_locale', locale);
}

export function loadUpdateChannel(): UpdateChannel {
  const raw = localStorage.getItem('esp32_update_channel');
  return raw === 'beta' ? 'beta' : 'stable';
}

export function saveUpdateChannel(channel: UpdateChannel): void {
  localStorage.setItem('esp32_update_channel', channel);
}

export function loadCloseToTray(): boolean {
  return localStorage.getItem('esp32_close_to_tray') === '1';
}

export function saveCloseToTray(enabled: boolean): void {
  localStorage.setItem('esp32_close_to_tray', enabled ? '1' : '0');
}
