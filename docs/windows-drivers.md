# Sterowniki USB-UART na Windows (ESP32)

ESP32 Display Studio (desktop Tauri lub Web Serial) wymaga, aby system widział płytkę jako port **COMx**.

## Szybka diagnostyka

1. Podłącz płytkę **kablem z liniami danych** (nie-only-charge).
2. Otwórz **Menedżer urządzeń** → **Porty (COM i LPT)**.
3. Po podłączeniu powinien pojawić się nowy `COMx`.
4. Jeśli urządzenie jest w **Inne urządzenia** / z żółtym wykrzyknikiem → brak sterownika.

W aplikacji: zakładka **Wykryj ESP32 (USB)** → **Porty COM** / **Wykryj**.

## Tabela VID → sterownik

| Chip / mostek | VID | Typowe płytki | Sterownik |
|---------------|-----|---------------|-----------|
| Espressif native USB | `0x303A` | ESP32-S3, C3, C6, S2 | Windows Update / [pakiet IDF](https://dl.espressif.com/dl/idf-driver/) |
| Silicon Labs CP210x | `0x10C4` | DevKit V1, WROOM | [CP210x VCP](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) |
| WCH CH340 / CH9102 | `0x1A86` | NodeMCU, D1 Mini | [CH341SER](https://www.wch-ic.com/downloads/CH341SER_EXE.html) |
| FTDI FT232 | `0x0403` | niektóre M5 / adaptery | [FTDI VCP](https://ftdichip.com/drivers/vcp-drivers/) |

Studio rozpoznaje te VID w `src/utils/usbEsp32Detector.ts` oraz w natywnym mostku Rust.

## Instalacja krok po kroku

### CP210x (DevKit V1)

1. Pobierz **CP210x Universal Windows Driver** ze strony Silicon Labs.
2. Zainstaluj, odłącz i podłącz płytkę.
3. W Menedżerze urządzeń sprawdź `Silicon Labs CP210x USB to UART Bridge (COMx)`.

### CH340 / CH9102

1. Pobierz oficjalny instalator **CH341SER** z WCH (unikaj nieoficjalnych mirrorów).
2. Zainstaluj jako administrator, jeśli Windows tego wymaga.
3. Szukaj `USB-SERIAL CH340 (COMx)`.

### Espressif native USB (S3 / C3)

1. Podłącz kabel do portu **USB** oznaczonego jako native / USB (nie UART-only, jeśli płytka ma dwa).
2. Pozwól Windows Update zainstalować **USB JTAG/serial debug unit**.
3. Gdy brak sterownika: użyj pakietu z [dl.espressif.com](https://dl.espressif.com/dl/idf-driver/).

## Typowe problemy

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| Brak nowego COMx | kabel tylko do ładowania | wymień kabel |
| „Nieznane urządzenie” | brak INF | zainstaluj sterownik z tabeli VID |
| COMx znika po restarcie | zasilanie / kabel | sprawdź port USB / hub |
| Port zajęty | Arduino IDE / inny monitor | zamknij inne programy używające COM |
| Web Serial nie widzi urządzenia | Firefox / brak uprawnień | użyj Edge/Chrome lub `npm run tauri:dev` |

## Plik w instalatorze

Po instalacji NSIS/MSI w katalogu aplikacji znajdziesz `DRIVERS.txt` (ta sama treść skrócona). Hook instalatora NSIS wyświetla też krótkie przypomnienie.

## Powiązane

- [Podpis Authenticode / SmartScreen](./windows-signing.md)
- [Instalator Windows (NSIS/MSI)](./windows-installer.md)
