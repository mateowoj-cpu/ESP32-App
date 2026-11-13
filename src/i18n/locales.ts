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
  'nav.mobile.simulator': 'Symulator',
  'nav.mobile.editor': 'Edytor UI',
  'nav.mobile.usb': 'Wykryj USB',
  'nav.mobile.automations': 'Automatyzacje',
  'nav.mobile.integrations': 'Integracje',
  'nav.mobile.code': 'Kod C++',
  'nav.mobile.settings': 'Ustawienia',
  'brand.sub': 'LCD · OLED · Sensory · C++',
  'footer.copy': 'ESP32 Display Studio © 2026 · Kompatybilny z ESP32 WROOM / ESP32-S3 / ESP32-C3 · Adafruit_SSD1306, TFT_eSPI, U8g2',
  'action.update': 'Update',
  'action.exportProject': '.esp32studio',
  'action.downloadIno': 'Pobierz .INO',
  'action.done': 'Gotowe',
  'action.copied': 'Skopiowano!',
  'action.copyCpp': 'Kopiuj C++',
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
  'desktop.diagnostics': 'Diagnostyka flash/COM (log lokalny)',
  'desktop.diagnosticsOpen': 'Otwórz folder logów',
  'desktop.hint':
    'Tray: Pokaż / Agent Start·Stop / Wyjdź. Autostart wymaga zainstalowanej aplikacji Tauri.',
  'desktop.refresh': 'Odśwież status',
  'locale.pl': 'Polski',
  'locale.en': 'English',
  'usb.title': 'Wykrywanie ESP32 przez USB',
  'usb.detect': 'Wykryj ESP32 przez USB',
  'usb.scanning': 'Skanowanie portów USB...',
  'usb.ports': 'Porty COM',
  'usb.pickPort': 'Wybierz port COM / tty',
  'usb.available': 'dostępnych',
  'usb.noDevice': 'Brak podłączonego ESP32',
  'usb.noDeviceHint':
    'Kliknij „Wykryj ESP32 przez USB” u góry lub wybierz płytkę z biblioteki popularnych modułów.',
  'usb.portOpen': 'port otwarty @ 115200',
  'usb.portClosed': 'brak otwartego portu',
  'usb.info': 'Informacja',
  'usb.recognized': 'ROZPOZNANY',
  'usb.apply': 'Zastosuj Piny i Konfigurację tego ESP32 do Projektu',
  'usb.applied': 'Pomyślnie Zastosowano do Projektu!',
  'usb.drivers': 'Pełna dokumentacja sterowników',
  'flash.title': 'Build → Flash',
  'flash.titleBrowser': 'Build & Flash (esptool)',
  'flash.browserHint':
    'Kompilacja PlatformIO / arduino-cli oraz flash dostępne w aplikacji desktop (Tauri). W przeglądarce pobierz .ino i zbuduj lokalnie.',
  'flash.port': 'Port COM',
  'flash.chip': 'Chip',
  'flash.baud': 'Baud',
  'flash.offset': 'Offset flash',
  'flash.firmware': 'Firmware (.bin)',
  'flash.pick': 'Wybierz',
  'flash.build': 'Build',
  'flash.flash': 'Flash',
  'flash.buildFlash': 'Build + Flash',
  'flash.checkingToolchain': 'Sprawdzanie PlatformIO / arduino-cli…',
  'flash.checkingEsptool': 'Sprawdzanie esptool…',
  'flash.installToolchain':
    'Sidecar: scripts/windows/Install-PlatformIoSidecar.ps1 — albo pip install platformio / arduino-cli w PATH.',
  'flash.sidecar': 'sidecar',
  'flash.log': 'Log build / flash / OTA',
  'flash.noLogs': 'Brak logów.',
  'ota.title': 'OTA Wi‑Fi',
  'ota.hint':
    'Wgraj .bin przez sieć (ArduinoOTA/espota lub HTTP POST /update). Szkic musi mieć OTA włączone w Ustawieniach.',
  'ota.host': 'IP ESP32',
  'ota.port': 'Port',
  'ota.password': 'Hasło OTA',
  'ota.method': 'Metoda',
  'ota.methodHttp': 'HTTP /update',
  'ota.upload': 'OTA Upload',
  'ota.checking': 'Sprawdzanie espota…',
  'ota.needFirmware': 'Najpierw zbuduj lub wybierz plik .bin.',
  'ota.needHost': 'Podaj adres IP ESP32 w LAN.',
  'sim.screen': 'Ekran',
  'sim.touch': 'Dotyk',
  'sim.touchOff': 'WYŁĄCZONY',
  'sim.state': 'Stan',
  'sim.on': 'WŁĄCZONY',
  'sim.sleep': 'UŚPIONY (SLEEP)',
  'sim.powerTitle': 'Przełącz zasilanie ekranu',
  'sim.displayOnly': 'Tylko Wyświetlanie',
  'sim.capacitive': 'Panel Pojemnościowy',
  'editor.palette': 'Paleta Elementów',
  'editor.paletteHint': 'Kliknij aby dodać',
  'editor.newScreen': 'Nowy ekran',
  'editor.liveTelemetry': 'Telemetria Live',
  'editor.clone': 'Klonuj',
  'auto.title': 'Centrum Automatyzacji i Zachowań Cyber-Zwierzaka',
  'auto.subtitle':
    'Definiuj reakcje urządzenia na czujniki GPIO, harmonogram wielominutowej osi czasu oraz generuj gotowy kod C++ dla ESP32.',
  'auto.tabBlocks': 'Klocki Reguł',
  'auto.tabTimeline': 'Oś Czasu i Generator (Timeline)',
  'auto.tabDsl': 'Język Skryptowy (DSL)',
  'auto.newRule': 'Nowa Reguła',
  'settings.ota': 'Aktualizacje OTA (Wi‑Fi)',
  'settings.otaEnable': 'Dołącz ArduinoOTA + HTTP /update do szkicu C++',
  'settings.otaPassword': 'Hasło ArduinoOTA',
  'settings.otaPort': 'Port ArduinoOTA',
  'code.title': 'Szkic Arduino IDE (.ino) dla Twojego ESP32',
  'code.desc':
    'Wygenerowany plik .ino zawiera kompletną logikę: sterownik ekranu, obsługę dotyku, sensory, API pogody, agenta PC oraz reguły automatyzacji.',
  'code.download': 'Pobierz Szkic (.ino)',
  'code.name': 'nazwa:',
  'code.downloaded': 'Pobrano plik:',
  'code.arduinoTip':
    'Wskazówka Arduino IDE: umieść plik w folderze o tej samej nazwie. Przy pierwszym otwarciu IDE zaproponuje utworzenie folderu.',
  'code.dismiss': 'Rozumiem, zamknij',
  'code.tabIno': 'Kod C++',
  'code.tabPio': 'platformio.ini',
  'code.tabPinout': 'Mapa pinów',
  'code.tabGuide': 'Przewodnik',
  'integ.weather': 'API Pogody w Czasie Rzeczywistym',
  'integ.pc': 'Monitor Zasobów Komputera (PC)',
  'integ.notify': 'Powiadomienia w Czasie Rzeczywistym',
  'settings.display': 'Parametry Ekranu i Motywy Wizualne',
  'settings.system': 'System, Wi‑Fi i Zasilanie',
  'common.lines': 'linii',
};

const en: Dict = {
  'nav.simulator': 'Hardware Simulator',
  'nav.editor': 'Visual UI Editor',
  'nav.usb': 'Detect ESP32 (USB)',
  'nav.automations': 'Automations & Pet',
  'nav.integrations': 'Integrations & API',
  'nav.code': 'C++ Code Generator',
  'nav.settings': 'Settings & Touch',
  'nav.mobile.simulator': 'Simulator',
  'nav.mobile.editor': 'UI Editor',
  'nav.mobile.usb': 'Detect USB',
  'nav.mobile.automations': 'Automations',
  'nav.mobile.integrations': 'Integrations',
  'nav.mobile.code': 'C++ Code',
  'nav.mobile.settings': 'Settings',
  'brand.sub': 'LCD · OLED · Sensors · C++',
  'footer.copy':
    'ESP32 Display Studio © 2026 · Compatible with ESP32 WROOM / ESP32-S3 / ESP32-C3 · Adafruit_SSD1306, TFT_eSPI, U8g2',
  'action.update': 'Update',
  'action.exportProject': '.esp32studio',
  'action.downloadIno': 'Download .INO',
  'action.done': 'Done',
  'action.copied': 'Copied!',
  'action.copyCpp': 'Copy C++',
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
  'desktop.diagnostics': 'Flash/COM diagnostics (local log)',
  'desktop.diagnosticsOpen': 'Open logs folder',
  'desktop.hint':
    'Tray: Show / Agent Start·Stop / Quit. Autostart requires the installed Tauri app.',
  'desktop.refresh': 'Refresh status',
  'locale.pl': 'Polski',
  'locale.en': 'English',
  'usb.title': 'ESP32 USB detection',
  'usb.detect': 'Detect ESP32 via USB',
  'usb.scanning': 'Scanning USB ports…',
  'usb.ports': 'COM ports',
  'usb.pickPort': 'Choose COM / tty port',
  'usb.available': 'available',
  'usb.noDevice': 'No ESP32 connected',
  'usb.noDeviceHint':
    'Click “Detect ESP32 via USB” above or pick a board from the popular modules library.',
  'usb.portOpen': 'port open @ 115200',
  'usb.portClosed': 'no open port',
  'usb.info': 'Info',
  'usb.recognized': 'DETECTED',
  'usb.apply': 'Apply this ESP32 pinout & config to the project',
  'usb.applied': 'Applied to project!',
  'usb.drivers': 'Full driver documentation',
  'flash.title': 'Build → Flash',
  'flash.titleBrowser': 'Build & Flash (esptool)',
  'flash.browserHint':
    'PlatformIO / arduino-cli builds and flashing are available in the desktop (Tauri) app. In the browser, download the .ino and build locally.',
  'flash.port': 'COM port',
  'flash.chip': 'Chip',
  'flash.baud': 'Baud',
  'flash.offset': 'Flash offset',
  'flash.firmware': 'Firmware (.bin)',
  'flash.pick': 'Browse',
  'flash.build': 'Build',
  'flash.flash': 'Flash',
  'flash.buildFlash': 'Build + Flash',
  'flash.checkingToolchain': 'Checking PlatformIO / arduino-cli…',
  'flash.checkingEsptool': 'Checking esptool…',
  'flash.installToolchain':
    'Sidecar: scripts/windows/Install-PlatformIoSidecar.ps1 — or pip install platformio / arduino-cli on PATH.',
  'flash.sidecar': 'sidecar',
  'flash.log': 'Build / flash / OTA log',
  'flash.noLogs': 'No logs yet.',
  'ota.title': 'Wi‑Fi OTA',
  'ota.hint':
    'Upload a .bin over the network (ArduinoOTA/espota or HTTP POST /update). Enable OTA in Settings for the generated sketch.',
  'ota.host': 'ESP32 IP',
  'ota.port': 'Port',
  'ota.password': 'OTA password',
  'ota.method': 'Method',
  'ota.methodHttp': 'HTTP /update',
  'ota.upload': 'OTA Upload',
  'ota.checking': 'Checking espota…',
  'ota.needFirmware': 'Build or pick a .bin first.',
  'ota.needHost': 'Enter the ESP32 LAN IP address.',
  'sim.screen': 'Display',
  'sim.touch': 'Touch',
  'sim.touchOff': 'OFF',
  'sim.state': 'State',
  'sim.on': 'ON',
  'sim.sleep': 'SLEEP',
  'sim.powerTitle': 'Toggle display power',
  'sim.displayOnly': 'Display only',
  'sim.capacitive': 'Capacitive panel',
  'editor.palette': 'Widget palette',
  'editor.paletteHint': 'Click to add',
  'editor.newScreen': 'New screen',
  'editor.liveTelemetry': 'Live telemetry',
  'editor.clone': 'Clone',
  'auto.title': 'Automations & Cyber-Pet behaviors',
  'auto.subtitle':
    'Define GPIO sensor reactions, multi-minute timeline schedules, and generate ready-to-flash C++ for ESP32.',
  'auto.tabBlocks': 'Rule blocks',
  'auto.tabTimeline': 'Timeline & generator',
  'auto.tabDsl': 'Script language (DSL)',
  'auto.newRule': 'New rule',
  'settings.ota': 'OTA updates (Wi‑Fi)',
  'settings.otaEnable': 'Include ArduinoOTA + HTTP /update in the C++ sketch',
  'settings.otaPassword': 'ArduinoOTA password',
  'settings.otaPort': 'ArduinoOTA port',
  'code.title': 'Arduino IDE sketch (.ino) for your ESP32',
  'code.desc':
    'The generated .ino includes display driver logic, touch, sensors, weather API, PC agent polling, and your automation rules.',
  'code.download': 'Download sketch (.ino)',
  'code.name': 'name:',
  'code.downloaded': 'Downloaded:',
  'code.arduinoTip':
    'Arduino IDE tip: keep the file in a folder with the same name. On first open, the IDE can create that folder for you.',
  'code.dismiss': 'Got it, close',
  'code.tabIno': 'C++ code',
  'code.tabPio': 'platformio.ini',
  'code.tabPinout': 'Pin map',
  'code.tabGuide': 'Guide',
  'integ.weather': 'Live Weather API',
  'integ.pc': 'PC Resource Monitor',
  'integ.notify': 'Realtime Notifications',
  'settings.display': 'Display parameters & themes',
  'settings.system': 'System, Wi‑Fi & power',
  'common.lines': 'lines',
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

export function loadDiagnosticsEnabled(): boolean {
  return localStorage.getItem('esp32_diagnostics') === '1';
}

export function saveDiagnosticsEnabled(enabled: boolean): void {
  localStorage.setItem('esp32_diagnostics', enabled ? '1' : '0');
}
