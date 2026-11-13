import { DisplayConfig, SystemConfig, ApiIntegrationsConfig, Screen, AutomationRule } from '../types';

export function generateArduinoCppCode(
  display: DisplayConfig,
  system: SystemConfig,
  api: ApiIntegrationsConfig,
  screens: Screen[],
  automations: AutomationRule[]
): string {
  const isI2C = display.bus === 'i2c';
  const width = display.width;
  const height = display.height;

  return `/*
 * ==============================================================================
 *  PROJEKT ESP32 DISPLAY STUDIO - WYGENEROWANY KOD C++
 *  Wyświetlacz: ${display.model.toUpperCase()} (${width}x${height})
 *  Magistrala:  ${display.bus.toUpperCase()} ${isI2C ? `(SDA: GPIO ${display.sdaPin}, SCL: GPIO ${display.sclPin}, Adres: ${display.i2cAddress})` : `(MOSI: ${display.mosiPin}, SCK: ${display.sckPin}, CS: ${display.csPin})`}
 * ==============================================================================
 *  WYMAGANE BIBLIOTEKI W ARDUINO IDE (Zainstaluj przez Library Manager):
 *  1. "Adafruit SSD1306" (by Adafruit)
 *  2. "Adafruit GFX Library" (by Adafruit)
 *  3. "ArduinoJson" (by Benoit Blanchon, wersja 6 lub 7)
 *  4. "WiFi", "HTTPClient", "WebServer" (wbudowane w pakiet ESP32)
 * ==============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WebServer.h>
#include <time.h>
${system.bluetoothEnabled ? (system.bluetoothMode === 'classic_spp' ? '#include <BluetoothSerial.h>' : '#include <BLEDevice.h>\n#include <BLEServer.h>\n#include <BLEUtils.h>\n#include <BLE2902.h>') : '// Bluetooth wyłączony w opcjach'}

// --- KONFIGURACJA EKRANU ---
#define SCREEN_WIDTH  ${width}
#define SCREEN_HEIGHT ${height}
#define OLED_RESET    ${display.rstPin}
#define SCREEN_ADDRESS ${display.i2cAddress}

#define SDA_PIN       ${display.sdaPin}
#define SCL_PIN       ${display.sclPin}

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
${system.bluetoothEnabled ? (system.bluetoothMode === 'classic_spp' ? 'BluetoothSerial SerialBT;' : 'BLEServer* pServer = NULL;\nBLECharacteristic* pTelemetryChar = NULL;\nbool bleConnected = false;') : ''}

// --- KONFIGURACJA SIECI & NTP ---
const char* WIFI_SSID     = "${system.wifiSsid}";
const char* WIFI_PASSWORD = "${system.wifiPassword}";
const char* NTP_SERVER    = "${system.ntpServer}";
const char* TIMEZONE      = "${system.timezone}";

// --- AUTO-PRZEŁĄCZANIE EKRANU PO PODŁĄCZENIU KABLA USB-C DO PC ---
#define USB_AUTO_SWITCH_ENABLED  ${system.usbAutoSwitchToPcMonitor ? 1 : 0}
#define USB_TARGET_SCREEN_INDEX  ${system.usbSwitchScreenIndex ?? 2}
#define USB_REVERT_ON_DISCONNECT ${system.usbDisconnectRevertScreen ? 1 : 0}

// --- KONFIGURACJA BLUETOOTH & BLE ---
#define BLUETOOTH_ENABLED        ${system.bluetoothEnabled ? 1 : 0}
#define BLUETOOTH_MODE           "${system.bluetoothMode ?? 'disabled'}"
#define BT_DEVICE_NAME           "${system.bluetoothDeviceName ?? 'ESP32-Display-Studio'}"

// --- PINY SPRZĘTOWE SENSORÓW I PERYFERIÓW (MAPA PINÓW) ---
#define PIN_BOOT_BTN   0     // Fabryczny przycisk BOOT
#define PIN_PIR_SENSOR ${system.pirPin ?? 14}    // Czujnik ruchu PIR (cyfrowy)
#define PIN_LDR_SENSOR ${system.ldrPin ?? 36}    // Fotorezystor (ADC1_CH0)
#define PIN_USER_BTN1  ${system.userBtn1Pin ?? 35}    // Opcjonalny przycisk dodatkowy
#define PIN_POT_ADC    ${system.potPin ?? 34}    // Potencjometr (ADC1_CH6)
#define PIN_BUZZER_PWM ${system.buzzerPin ?? 18}   // Generator tonów / PWM Buzzer
#define PIN_STATUS_LED ${system.ledPin ?? 2}      // Dioda statusowa / LED

// --- KONFIGURACJA EKRANU DOTYKOWEGO (${display.touchController.toUpperCase()}) ---
#define TOUCH_ENABLED     ${display.touchEnabled ? 1 : 0}
#define TOUCH_CONTROLLER  "${display.touchController}"
#define PIN_TOUCH_SDA     ${display.touchSdaPin}
#define PIN_TOUCH_SCL     ${display.touchSclPin}
#define PIN_TOUCH_INT     ${display.touchIntPin}
#define PIN_TOUCH_RST     ${display.touchRstPin}

// --- SERWER WWW DLA POWIADOMIEŃ I MONITORINGU PC ---
WebServer server(${api.pcMonitor.port});

// --- ZMIENNE STANU SYSTEMOWEGO ---
int currentScreenIndex = 0;
const int TOTAL_SCREENS = ${screens.length};
bool isDisplayAwake = true;
unsigned long lastActivityMillis = 0;
const unsigned long SLEEP_TIMEOUT_MS = ${system.deepSleepTimeoutSec > 0 ? system.deepSleepTimeoutSec * 1000 : 0};

// Stany USB i Bluetooth
bool isUsbConnected = false;
int previousScreenBeforeUsb = 0;
unsigned long lastUsbPacketMillis = 0;

// Stany symulowane/odczytane
float currentTemperature = 21.5;
float currentHumidity = 50.0;
int currentAmbientLux = 350;

// Zasoby komputera PC (RAM, CPU, Karta graficzna, Dysk)
int currentCpuUsage = 35;
int currentRamUsage = 60;
int currentGpuUsage = 40;
int currentDiskUsage = ${api.pcMonitor.data.diskUsage ?? 64}; // Zajętość dysku C: %
int currentNetSpeedKb = 1200;

// Ostatnie powiadomienie
String lastNotificationTitle = "${api.notifications.list[0]?.title || 'ESP32'}";
String lastNotificationMsg = "${api.notifications.list[0]?.message || 'Start'}";
unsigned long notificationDisplayUntil = 0;

// Cyber-Pet: Nastrój, animacja i wielominutowa oś czasu zachowań
enum PetMood { 
  MOOD_NEUTRAL, 
  MOOD_BLINK, 
  MOOD_HAPPY, 
  MOOD_SURPRISED, 
  MOOD_SLEEP, 
  MOOD_YAWN, 
  MOOD_ANGRY,
  MOOD_LOOK_AROUND,
  MOOD_LOOK_UP,
  MOOD_LOOK_LEFT,
  MOOD_LOOK_RIGHT,
  MOOD_CRAZY,
  MOOD_DIZZY
};
PetMood currentPetMood = MOOD_NEUTRAL;
unsigned long lastBlinkMillis = 0;
int eyeGlanceOffset = 0; // -6..+6
bool isBlinking = false;

// Timery dla nieblokującej pętli loop()
unsigned long lastWeatherFetchMillis = 0;
const unsigned long WEATHER_INTERVAL_MS = ${api.weather.refreshIntervalMin * 60 * 1000};
unsigned long lastSensorReadMillis = 0;

// ==============================================================================
//  DEKLARACJE FUNKCJI RYSOWANIA
// ==============================================================================
void drawCyberPetEyes(int x, int y, int w, int h, PetMood mood);
void renderActiveScreen();
void fetchWeatherData();
void setupWebServer();
void checkAutomations();

// ==============================================================================
//  SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\\n[ESP32 Display Studio] Uruchamianie..."));

  // Identyfikacja układu ESP32 przez port szeregowy USB
  Serial.printf("[SPRZĘT] Model Chipu: %s (Rewizja %d, Rdzenie: %d)\\n", ESP.getChipModel(), ESP.getChipRevision(), ESP.getChipCores());
  Serial.printf("[SPRZĘT] Flash: %d MB, Taktowanie CPU: %d MHz\\n", ESP.getFlashChipSize() / (1024 * 1024), ESP.getCpuFreqMHz());
  Serial.printf("[SPRZĘT] Wi-Fi MAC: %s\\n", WiFi.macAddress().c_str());

  // Inicjalizacja magistrali I2C
  Wire.begin(SDA_PIN, SCL_PIN);

  // Inicjalizacja wyświetlacza OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("BŁĄD: Nie znaleziono wyświetlacza SSD1306!"));
    for (;;); // Zatrzymaj jeśli brak ekranu
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(10, 20);
  display.println(F("ESP32 Studio Booting..."));
  display.display();

  // Konfiguracja pinów GPIO
  pinMode(PIN_BOOT_BTN, INPUT_PULLUP);
  pinMode(PIN_PIR_SENSOR, INPUT);
  pinMode(PIN_USER_BTN1, INPUT_PULLUP);
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, HIGH);

  // Konfiguracja sprzętowego kanału PWM dla buzzera / tonów
  ledcSetup(0, 2000, 8); // Kanał 0, 2 kHz, 8-bit
  ledcAttachPin(PIN_BUZZER_PWM, 0);

  // Inicjalizacja panelu dotykowego
  #if TOUCH_ENABLED
  pinMode(PIN_TOUCH_INT, INPUT_PULLUP);
  Serial.println(F("[DOTYK] Zainicjalizowano kontroler ekranu dotykowego (${display.touchController.toUpperCase()})"));
  #endif

  // Inicjalizacja łączności Bluetooth
  #if BLUETOOTH_ENABLED
  ${system.bluetoothMode === 'classic_spp'
    ? `SerialBT.begin(BT_DEVICE_NAME);
  Serial.println(F("[BLUETOOTH] Bluetooth Classic SPP uruchomiony jako: " BT_DEVICE_NAME));`
    : `BLEDevice::init(BT_DEVICE_NAME);
  BLEDevice::setPower((esp_power_level_t)${Math.max(0, Math.min(7, Math.floor(((system.bleTxPower ?? 3) + 12) / 3)))});
  pServer = BLEDevice::createServer();
  BLEService* pService = pServer->createService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
  pTelemetryChar = pService->createCharacteristic("beb5483e-36e1-4688-b7f5-ea07361b26a8", BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  pTelemetryChar->addDescriptor(new BLE2902());
  pService->start();
  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();
  Serial.println(F("[BLUETOOTH] BLE GATT Server rozgłasza jako: " BT_DEVICE_NAME));`}
  #endif

  // Łączenie z WiFi
  Serial.print(F("Łączenie z WiFi: "));
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(400);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\\nWiFi połączone!"));
    Serial.print(F("Adres IP: "));
    Serial.println(WiFi.localIP());

    // Konfiguracja czasu NTP
    configTzTime(TIMEZONE, NTP_SERVER);
    
    // Inicjalizacja serwera WWW dla powiadomień i agenta PC
    setupWebServer();
    
    // Pobranie pierwszej pogody
    fetchWeatherData();
  } else {
    Serial.println(F("\\nNie udało się połączyć z WiFi - praca w trybie offline"));
  }

  lastActivityMillis = millis();
  display.clearDisplay();
  display.display();
}

// ==============================================================================
//  PĘTLA GŁÓWNA LOOP
// ==============================================================================
void loop() {
  // Obsługa żądań serwera HTTP (np. z aplikacji na PC)
  server.handleClient();

  unsigned long currentMillis = millis();

  // Odczyt sensorów co 250ms
  if (currentMillis - lastSensorReadMillis > 250) {
    lastSensorReadMillis = currentMillis;
    // Odczyt poziomu oświetlenia LDR (odwrócona skala)
    int ldrRaw = analogRead(PIN_LDR_SENSOR);
    currentAmbientLux = map(ldrRaw, 0, 4095, 1000, 0);

    // Sprawdzenie automatyzacji i zdarzeń sensorów
    checkAutomations();
  }

  // Pobieranie pogody co zadany interwał
  if (WiFi.status() == WL_CONNECTED && (currentMillis - lastWeatherFetchMillis > WEATHER_INTERVAL_MS)) {
    lastWeatherFetchMillis = currentMillis;
    fetchWeatherData();
  }

  // Animacje oczu zwierzaka (mruganie co ~3.5 sekundy)
  if (currentPetMood == MOOD_NEUTRAL) {
    if (!isBlinking && (currentMillis - lastBlinkMillis > 3500)) {
      isBlinking = true;
      lastBlinkMillis = currentMillis;
    } else if (isBlinking && (currentMillis - lastBlinkMillis > 180)) {
      isBlinking = false;
      lastBlinkMillis = currentMillis;
      // Losowe spojrzenie w bok
      int r = random(0, 10);
      eyeGlanceOffset = (r == 1) ? -4 : (r == 2 ? 4 : 0);
    }
  }

  // Rysowanie klatki ekranu
  if (isDisplayAwake) {
    display.clearDisplay();
    renderActiveScreen();
    display.display();
  }

  delay(30); // ~33 FPS
}

// ==============================================================================
//  RENDEROWANIE AKTYWNEGO EKRANU (WEDŁUG PROJEKTU W EDYTORZE)
// ==============================================================================
void renderActiveScreen() {
  // Jeśli aktywne jest powiadomienie - wyświetl baner na wierzchu
  if (millis() < notificationDisplayUntil) {
    display.fillRoundRect(2, 2, SCREEN_WIDTH - 4, SCREEN_HEIGHT - 4, 3, SSD1306_BLACK);
    display.drawRoundRect(2, 2, SCREEN_WIDTH - 4, SCREEN_HEIGHT - 4, 3, SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(8, 8);
    display.print(F("[!] "));
    display.println(lastNotificationTitle);
    display.drawLine(6, 20, SCREEN_WIDTH - 6, 20, SSD1306_WHITE);
    display.setCursor(8, 26);
    display.println(lastNotificationMsg);
    return;
  }

  // Renderowanie właściwego ekranu
  switch (currentScreenIndex) {
${screens.map((screen, idx) => `    case ${idx}: // ${screen.name} (Sekwencja wejścia: ${screen.animationSequenceEnabled ? 'Włączona' : 'Statyczna'})
    {
${[...screen.widgets].sort((a, b) => (a.sequenceOrder ?? 1) - (b.sequenceOrder ?? 1)).map(w => {
  const headerComment = `      // [Krok #${w.sequenceOrder ?? 1}] ${w.label || w.type} (Animacja: ${w.animationType || 'fade_in'}, Start: ${w.animationDelayMs || 0}ms, Trwanie: ${w.animationDurationMs || 500}ms)`;
  if (w.type === 'cyber_pet') {
    return `${headerComment}
      drawCyberPetEyes(${w.x}, ${w.y}, ${w.width}, ${w.height}, currentPetMood);`;
  } else if (w.type === 'clock') {
    return `${headerComment}
      // Zegar czasu rzeczywistego
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
        display.setCursor(${w.x}, ${w.y});
        display.printf("%02d:%02d${w.showSeconds ? ':%02d' : ''}", timeinfo.tm_hour, timeinfo.tm_min${w.showSeconds ? ', timeinfo.tm_sec' : ''});
      }`;
  } else if (w.type === 'text') {
    if (w.binding === 'pirActive' || w.binding === 'pir') {
      return `      // Odczyt czujnika ruchu PIR (GPIO 14)
      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.print(digitalRead(PIN_PIR_SENSOR) == HIGH ? "${w.sensorActiveLabel || 'RUCH WYKRYTY!'}" : "${w.sensorInactiveLabel || 'Brak ruchu'}");`;
    } else if (w.binding === 'ambientLux' || w.binding === 'lux') {
      return `      // Odczyt fotorezystora LDR (GPIO 36)
      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.printf("%d ${w.unit || 'lx'}", currentAmbientLux);`;
    } else if (w.binding === 'potAdc' || w.binding === 'pot') {
      return `      // Odczyt potencjometru ADC (GPIO 34)
      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.printf("POT: %d", analogRead(PIN_POT_SENSOR));`;
    } else if (w.binding === 'temp' || w.binding === 'temperature') {
      return `      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.printf("%.1f C", currentTemperature);`;
    } else if (w.binding === 'humidity') {
      return `      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.printf("WILG: %d%%", currentHumidity);`;
    } else if (w.binding === 'usbConnected') {
      return `      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.print(isUsbConnected ? "${w.sensorActiveLabel || 'USB: POLACZONO'}" : "${w.sensorInactiveLabel || 'USB: ROZLACZONO'}");`;
    } else if (w.binding === 'cpu') {
      return `      display.setTextSize(1);
      display.setCursor(${w.x}, ${w.y});
      display.printf("CPU: %d%%", currentCpuUsage);`;
    } else if (w.binding === 'ram') {
      return `      display.setTextSize(1);
      display.setCursor(${w.x}, ${w.y});
      display.printf("RAM: %d%%", currentRamUsage);`;
    } else {
      return `      display.setTextSize(${w.fontSize && w.fontSize > 12 ? 2 : 1});
      display.setCursor(${w.x}, ${w.y});
      display.print("${w.label || ''}");`;
    }
  } else if (w.type === 'battery_wifi') {
    return `      // Ikony WiFi & Bateria
      display.drawRect(${w.x}, ${w.y}, 14, 7, SSD1306_WHITE);
      display.fillRect(${w.x} + 2, ${w.y} + 2, 8, 3, SSD1306_WHITE);
      display.drawPixel(${w.x} + 14, ${w.y} + 2, SSD1306_WHITE);
      display.setCursor(${w.x} + 17, ${w.y});
      display.print(WiFi.status() == WL_CONNECTED ? "W" : "x");`;
  } else if (w.type === 'gauge' || w.type === 'progress_bar') {
    const bindExpr = (w.binding === 'temp' || w.binding === 'temperature') ? 'currentTemperature' :
      (w.binding === 'lux' || w.binding === 'ambientLux') ? 'currentAmbientLux' :
      (w.binding === 'pot' || w.binding === 'potAdc') ? 'analogRead(PIN_POT_SENSOR)' :
      (w.binding === 'humidity') ? 'currentHumidity' :
      (w.binding === 'ram') ? 'currentRamUsage' :
      (w.binding === 'gpu') ? 'currentGpuUsage' :
      (w.binding === 'disk') ? 'currentDiskUsage' :
      'currentCpuUsage';
    return `      // Pasek postępu czujnika: ${w.label || w.binding || 'Wskaźnik'}
      display.drawRect(${w.x}, ${w.y}, ${w.width}, ${w.height}, SSD1306_WHITE);
      int fillW = map(${bindExpr}, ${w.minVal || 0}, ${w.maxVal || 100}, 0, ${w.width} - 4);
      fillW = constrain(fillW, 0, ${w.width} - 4);
      display.fillRect(${w.x} + 2, ${w.y} + 2, fillW, ${w.height} - 4, SSD1306_WHITE);`;
  } else if (w.type === 'weather') {
    return `      // Widget Pogody
      display.drawCircle(${w.x} + 12, ${w.y} + 12, 8, SSD1306_WHITE);
      display.setCursor(${w.x} + 26, ${w.y} + 2);
      display.printf("%.1f C", currentTemperature);
      display.setCursor(${w.x} + 26, ${w.y} + 14);
      display.print("${api.weather.city}");`;
  } else if (w.type === 'pc_monitor') {
    return `      // Monitor Zasobów PC (RAM, CPU, Karta Graficzna, Dysk)
      display.setCursor(${w.x}, ${w.y});
      display.printf("CPU:%d%% RAM:%d%%", currentCpuUsage, currentRamUsage);
      display.setCursor(${w.x}, ${w.y} + 10);
      display.printf("GPU:%d%% DYSK:%d%%", currentGpuUsage, currentDiskUsage);
      // Paski wskaźników zasobów PC
      int bW = (${w.width} - 12) / 4;
      display.drawRect(${w.x}, ${w.y} + 20, bW, 4, SSD1306_WHITE);
      display.fillRect(${w.x} + 1, ${w.y} + 21, map(currentCpuUsage, 0, 100, 1, bW - 2), 2, SSD1306_WHITE);
      display.drawRect(${w.x} + bW + 4, ${w.y} + 20, bW, 4, SSD1306_WHITE);
      display.fillRect(${w.x} + bW + 5, ${w.y} + 21, map(currentRamUsage, 0, 100, 1, bW - 2), 2, SSD1306_WHITE);
      display.drawRect(${w.x} + (bW + 4) * 2, ${w.y} + 20, bW, 4, SSD1306_WHITE);
      display.fillRect(${w.x} + (bW + 4) * 2 + 1, ${w.y} + 21, map(currentGpuUsage, 0, 100, 1, bW - 2), 2, SSD1306_WHITE);
      display.drawRect(${w.x} + (bW + 4) * 3, ${w.y} + 20, bW, 4, SSD1306_WHITE);
      display.fillRect(${w.x} + (bW + 4) * 3 + 1, ${w.y} + 21, map(currentDiskUsage, 0, 100, 1, bW - 2), 2, SSD1306_WHITE);`;
  } else if (w.type === 'sparkline') {
    return `      // Mini wykres liniowy
      display.drawRect(${w.x}, ${w.y}, ${w.width}, ${w.height}, SSD1306_WHITE);
      for (int i = 0; i < ${w.width} - 6; i += 4) {
        int h = random(2, ${w.height} - 4);
        display.drawLine(${w.x} + 2 + i, ${w.y} + ${w.height} - 2, ${w.x} + 2 + i, ${w.y} + ${w.height} - 2 - h, SSD1306_WHITE);
      }`;
  } else if (w.type === 'menu') {
    return `      // Menu
      display.setCursor(${w.x}, ${w.y});
      display.println(F("${w.menuTitle || 'MENU'}"));
      display.drawLine(${w.x}, ${w.y} + 10, ${w.x} + ${w.width}, ${w.y} + 10, SSD1306_WHITE);
      ${(w.menuItems || []).map((item, i) => `display.setCursor(${w.x} + 4, ${w.y} + 14 + ${i * 10}); display.println(F("${item}"));`).join('\n      ')}`;
  }
  return '';
}).filter(Boolean).join('\n')}
      break;
    }
`).join('\n')}
    default:
      display.setCursor(10, 20);
      display.print("Ekran domyślny");
      break;
  }
}

// ==============================================================================
//  RYSOWANIE ANIMOWANYCH OCZU CYBER-PET (Wektorowo bez ciężkich grafik)
// ==============================================================================
void drawCyberPetEyes(int x, int y, int w, int h, PetMood mood) {
  int eyeWidth = w / 2 - 8;
  int eyeHeight = h - 6;
  int leftEyeX = x + 2;
  int rightEyeX = x + w / 2 + 6;
  int eyeY = y + 3;

  if (mood == MOOD_SLEEP) {
    // Śpiące oczy (zamknięte łuki/kreski)
    display.drawLine(leftEyeX, eyeY + eyeHeight / 2, leftEyeX + eyeWidth, eyeY + eyeHeight / 2, SSD1306_WHITE);
    display.drawLine(rightEyeX, eyeY + eyeHeight / 2, rightEyeX + eyeWidth, eyeY + eyeHeight / 2, SSD1306_WHITE);
    // Animowane Zzz
    display.setCursor(rightEyeX + eyeWidth - 2, y - 2);
    display.print("Zzz");
    return;
  }

  if (mood == MOOD_HAPPY) {
    // Wesołe oczy (łuki w górę ^_^)
    display.drawCircle(leftEyeX + eyeWidth / 2, eyeY + eyeHeight / 2, eyeWidth / 2, SSD1306_WHITE);
    display.fillRect(leftEyeX, eyeY + eyeHeight / 2 + 1, eyeWidth + 2, eyeHeight / 2 + 2, SSD1306_BLACK);
    display.drawCircle(rightEyeX + eyeWidth / 2, eyeY + eyeHeight / 2, eyeWidth / 2, SSD1306_WHITE);
    display.fillRect(rightEyeX, eyeY + eyeHeight / 2 + 1, eyeWidth + 2, eyeHeight / 2 + 2, SSD1306_BLACK);
    return;
  }

  if (isBlinking || mood == MOOD_BLINK) {
    // Mrugnięcie (wąska pozioma linia)
    display.fillRect(leftEyeX, eyeY + eyeHeight / 2 - 1, eyeWidth, 3, SSD1306_WHITE);
    display.fillRect(rightEyeX, eyeY + eyeHeight / 2 - 1, eyeWidth, 3, SSD1306_WHITE);
    return;
  }

  if (mood == MOOD_YAWN) {
    // Ziewanie (duże przymknięte oczy i buźka 'O')
    display.fillRoundRect(leftEyeX, eyeY + 4, eyeWidth, eyeHeight - 8, 4, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY + 4, eyeWidth, eyeHeight - 8, 4, SSD1306_WHITE);
    display.drawCircle(x + w / 2, eyeY + eyeHeight - 2, 4, SSD1306_WHITE);
    return;
  }

  if (mood == MOOD_SURPRISED) {
    // Zaskoczenie (wielkie szerokie oczy)
    display.fillRoundRect(leftEyeX, eyeY - 2, eyeWidth + 2, eyeHeight + 4, 8, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY - 2, eyeWidth + 2, eyeHeight + 4, 8, SSD1306_WHITE);
    // Czarne źrenice w środku
    display.fillCircle(leftEyeX + eyeWidth / 2, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    display.fillCircle(rightEyeX + eyeWidth / 2, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    return;
  }

  if (mood == MOOD_LOOK_UP) {
    // Patrzenie do góry (podniesione źrenice)
    display.fillRoundRect(leftEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillCircle(leftEyeX + eyeWidth / 2, eyeY + 4, 3, SSD1306_BLACK);
    display.fillCircle(rightEyeX + eyeWidth / 2, eyeY + 4, 3, SSD1306_BLACK);
    return;
  }

  if (mood == MOOD_LOOK_LEFT) {
    // Zerkanie w lewo
    display.fillRoundRect(leftEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillCircle(leftEyeX + 4, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    display.fillCircle(rightEyeX + 4, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    return;
  }

  if (mood == MOOD_LOOK_RIGHT) {
    // Zerkanie w prawo
    display.fillRoundRect(leftEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillCircle(leftEyeX + eyeWidth - 4, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    display.fillCircle(rightEyeX + eyeWidth - 4, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    return;
  }

  if (mood == MOOD_LOOK_AROUND) {
    // Rozglądanie się (płynny ruch wahadłowy w czasie)
    int sweep = (int)(sin(millis() / 350.0) * (eyeWidth / 3.2));
    display.fillRoundRect(leftEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillCircle(leftEyeX + eyeWidth / 2 + sweep, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    display.fillCircle(rightEyeX + eyeWidth / 2 + sweep, eyeY + eyeHeight / 2, 3, SSD1306_BLACK);
    return;
  }

  if (mood == MOOD_CRAZY || mood == MOOD_DIZZY) {
    // Zaczyna wariować / wirujące oczy / party mode
    float angle = millis() / 150.0;
    int offX = (int)(cos(angle) * (eyeWidth / 3.5));
    int offY = (int)(sin(angle) * (eyeHeight / 3.5));
    display.fillRoundRect(leftEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
    display.fillCircle(leftEyeX + eyeWidth / 2 + offX, eyeY + eyeHeight / 2 + offY, 3, SSD1306_BLACK);
    display.fillCircle(rightEyeX + eyeWidth / 2 - offX, eyeY + eyeHeight / 2 - offY, 3, SSD1306_BLACK);
    return;
  }

  // Domyślne oczy kapsułowe z przesunięciem spojrzenia (glance)
  display.fillRoundRect(leftEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
  display.fillRoundRect(rightEyeX, eyeY, eyeWidth, eyeHeight, 6, SSD1306_WHITE);
  
  // Wycinek wewnętrzny dający efekt robotycznych powiek / źrenic
  int pupilX_L = leftEyeX + eyeWidth / 2 + eyeGlanceOffset;
  int pupilX_R = rightEyeX + eyeWidth / 2 + eyeGlanceOffset;
  display.fillCircle(pupilX_L, eyeY + eyeHeight / 2, 2, SSD1306_BLACK);
  display.fillCircle(pupilX_R, eyeY + eyeHeight / 2, 2, SSD1306_BLACK);
}

// ==============================================================================
//  OBSŁUGA AUTOMATYZACJI I ZDARZEŃ CZUJNIKÓW
// ==============================================================================
void checkAutomations() {
  // ==============================================================================
  //  OBSŁUGA AUTO-PRZEŁĄCZANIA EKRANU PO PODŁĄCZENIU KABLA USB-C DO PC
  // ==============================================================================
  #if USB_AUTO_SWITCH_ENABLED
  // Wykrywanie aktywnego połączenia USB z komputerem
  bool usbNowConnected = false;
  #if defined(CONFIG_IDF_TARGET_ESP32S3) || defined(CONFIG_IDF_TARGET_ESP32C3)
    usbNowConnected = Serial && Serial.dtr();
  #else
    usbNowConnected = Serial || (millis() - lastUsbPacketMillis < 4000);
  #endif

  if (usbNowConnected && !isUsbConnected) {
    isUsbConnected = true;
    previousScreenBeforeUsb = currentScreenIndex;
    currentScreenIndex = USB_TARGET_SCREEN_INDEX;
    isDisplayAwake = true;
    lastActivityMillis = millis();
    Serial.println(F("[USB-C] Podłączono kabel USB-C -> Ekran automatycznie przełączony na Monitor Zasobów PC (CPU, RAM, GPU, Dysk)!"));
  } else if (!usbNowConnected && isUsbConnected) {
    isUsbConnected = false;
    #if USB_REVERT_ON_DISCONNECT
    currentScreenIndex = previousScreenBeforeUsb;
    Serial.println(F("[USB-C] Odłączono kabel USB-C -> Powrót do poprzedniego ekranu"));
    #endif
  }
  #endif

  // Przycisk BOOT (GPIO 0) przełącza ekrany
  if (digitalRead(PIN_BOOT_BTN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(PIN_BOOT_BTN) == LOW) {
      currentScreenIndex = (currentScreenIndex + 1) % TOTAL_SCREENS;
      lastActivityMillis = millis();
      isDisplayAwake = true;
      Serial.printf("Przełączono na ekran: %d\\n", currentScreenIndex);
      while (digitalRead(PIN_BOOT_BTN) == LOW) delay(10);
    }
  }

  // Sprawdzenie czujnika ruchu PIR (GPIO 14)
  bool motionDetected = digitalRead(PIN_PIR_SENSOR) == HIGH;
  if (motionDetected) {
    lastActivityMillis = millis();
    if (!isDisplayAwake) {
      isDisplayAwake = true;
      Serial.println(F("PIR: Wybudzono ekran!"));
    }
    // Zwierzak staje się wesoły/zaskoczony gdy widzi człowieka
    currentPetMood = MOOD_HAPPY;
  } else if (currentPetMood == MOOD_HAPPY && (millis() - lastActivityMillis > 5000)) {
    currentPetMood = MOOD_NEUTRAL;
  }

  // Sprawdzenie godziny dla ziewania i snu (np. 23:00)
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    if (timeinfo.tm_hour >= 23 || timeinfo.tm_hour < 6) {
      if (currentPetMood != MOOD_SLEEP) {
        currentPetMood = MOOD_SLEEP;
      }
    }
  }

  // Wygaszanie przy bezczynności
  if (SLEEP_TIMEOUT_MS > 0 && isDisplayAwake && (millis() - lastActivityMillis > SLEEP_TIMEOUT_MS)) {
    isDisplayAwake = false;
    display.clearDisplay();
    display.display();
    Serial.println(F("Ekran wygaszony (Deep Sleep timeout)"));
  }
}

// ==============================================================================
//  POBIERANIE POGODY W CZASIE RZECZYWISTYM (${(api.weather.provider || 'open-meteo').toUpperCase()})
// ==============================================================================
void fetchWeatherData() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
${(() => {
  const provider = api.weather.provider || 'open-meteo';
  if (provider === 'wttr-in') {
    return `  // Bezpłatne API wttr.in bez klucza (miasto: ${api.weather.city})
  String url = "http://wttr.in/${encodeURIComponent(api.weather.city)}?format=j1";
  http.begin(url);
  http.setUserAgent("ESP32-Weather-Client/1.0");
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      currentTemperature = doc["current_condition"][0]["temp_C"].as<float>();
      currentHumidity = doc["current_condition"][0]["humidity"].as<int>();
      Serial.printf("Pobrano pogodę wttr.in dla %s: %.1f C, Wilg: %d%%\\n", "${api.weather.city}", currentTemperature, currentHumidity);
    }
  }`;
  } else if (provider === 'openweathermap') {
    return `  // Bezpłatny plan OpenWeatherMap API (miasto: ${api.weather.city})
  String url = "http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(api.weather.city)}&units=metric&appid=${api.weather.apiKey || 'TWOJ_KLUCZ_API'}";
  http.begin(url);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      currentTemperature = doc["main"]["temp"].as<float>();
      currentHumidity = doc["main"]["humidity"].as<int>();
      Serial.printf("Pobrano pogodę OpenWeatherMap dla %s: %.1f C, Wilg: %d%%\\n", "${api.weather.city}", currentTemperature, currentHumidity);
    }
  }`;
  } else if (provider === 'custom') {
    return `  // Własny endpoint REST (Home Assistant / Local Server)
  String url = "${api.weather.customEndpoint || 'http://api.open-meteo.com/v1/forecast?latitude=' + api.weather.latitude + '&longitude=' + api.weather.longitude + '&current_weather=true'}";
  http.begin(url);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      if (doc.containsKey("temperature")) currentTemperature = doc["temperature"];
      else if (doc.containsKey("current_weather")) currentTemperature = doc["current_weather"]["temperature"];
      Serial.printf("Pobrano pogodę z własnego API: %.1f C\\n", currentTemperature);
    }
  }`;
  } else {
    // Open-Meteo (default)
    return `  // Darmowe publiczne Open-Meteo API bez konieczności klucza (miasto: ${api.weather.city}, lat: ${api.weather.latitude}, lon: ${api.weather.longitude})
  String url = "http://api.open-meteo.com/v1/forecast?latitude=${api.weather.latitude}&longitude=${api.weather.longitude}&current_weather=true";
  http.begin(url);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      currentTemperature = doc["current_weather"]["temperature"];
      Serial.printf("Pobrano pogodę Open-Meteo dla %s: %.1f C\\n", "${api.weather.city}", currentTemperature);
    }
  }`;
  }
})()}
  http.end();
}

// ==============================================================================
//  SERWER WWW DLA AGENTA PC ORAZ POWIADOMIEŃ HTTP REST
// ==============================================================================
void setupWebServer() {
  // Endpoint aktualizacji statystyk PC: POST /api/pc-stats {"cpu": 45, "ram": 62, "gpu": 30, "disk": 64}
  server.on("/api/pc-stats", HTTP_POST, []() {
    if (server.hasArg("plain")) {
      DynamicJsonDocument doc(512);
      deserializeJson(doc, server.arg("plain"));
      if (doc.containsKey("cpu")) currentCpuUsage = doc["cpu"];
      if (doc.containsKey("ram")) currentRamUsage = doc["ram"];
      if (doc.containsKey("gpu")) currentGpuUsage = doc["gpu"];
      if (doc.containsKey("disk")) currentDiskUsage = doc["disk"];
      lastUsbPacketMillis = millis();
      lastActivityMillis = millis();
      server.send(200, "application/json", "{\\"status\\":\\"ok\\"}");
    } else {
      server.send(400, "text/plain", "Brak danych");
    }
  });

  // Endpoint odbierania powiadomień: POST /api/notify {"title": "Alarm", "message": "Ktoś dzwoni"}
  server.on("/api/notify", HTTP_POST, []() {
    if (server.hasArg("plain")) {
      DynamicJsonDocument doc(512);
      deserializeJson(doc, server.arg("plain"));
      lastNotificationTitle = doc["title"].as<String>();
      lastNotificationMsg = doc["message"].as<String>();
      notificationDisplayUntil = millis() + (${api.notifications.displayDurationSec} * 1000);
      isDisplayAwake = true;
      lastActivityMillis = millis();
      server.send(200, "application/json", "{\\"status\\":\\"notified\\"}");
    } else {
      server.send(400, "text/plain", "Brak treści");
    }
  });

  server.begin();
  Serial.println(F("Serwer HTTP REST uruchomiony na porcie ${api.pcMonitor.port}"));
}
`;
}

export type PioBoardProfile = 'esp32' | 'esp32s2' | 'esp32s3' | 'esp32c3' | 'esp32c6';

export function resolvePioBoardProfile(chipFamilyOrModel?: string | null): PioBoardProfile {
  const raw = (chipFamilyOrModel || '').toLowerCase();
  if (raw.includes('c6')) return 'esp32c6';
  if (raw.includes('c3')) return 'esp32c3';
  if (raw.includes('s3')) return 'esp32s3';
  if (raw.includes('s2')) return 'esp32s2';
  return 'esp32';
}

export function pioBoardId(profile: PioBoardProfile): { env: string; board: string } {
  switch (profile) {
    case 'esp32s3':
      return { env: 'esp32s3', board: 'esp32-s3-devkitc-1' };
    case 'esp32c3':
      return { env: 'esp32c3', board: 'esp32-c3-devkitm-1' };
    case 'esp32s2':
      return { env: 'esp32s2', board: 'esp32-s2-saola-1' };
    case 'esp32c6':
      return { env: 'esp32c6', board: 'esp32-c6-devkitc-1' };
    default:
      return { env: 'esp32dev', board: 'esp32dev' };
  }
}

export function generatePlatformIoIni(
  display: DisplayConfig,
  boardProfile: PioBoardProfile = 'esp32',
): string {
  const { env, board } = pioBoardId(boardProfile);
  return `; ==============================================================================
;  PLATFORMIO CONFIGURATION (platformio.ini)
;  Display: ${display.model} · board profile: ${boardProfile}
; ==============================================================================
[env:${env}]
platform = espressif32
board = ${board}
framework = arduino
monitor_speed = 115200
upload_speed = 921600

lib_deps =
    adafruit/Adafruit SSD1306@^2.5.9
    adafruit/Adafruit GFX Library@^1.11.9
    bblanchon/ArduinoJson@^6.21.4
    Wire
    WiFi
    HTTPClient
    WebServer
`;
}

export function generatePythonPcAgentScript(ipAddress = '192.168.1.150', port = 8080): string {
  return `#!/usr/bin/env python3
"""
ESP32 Display Studio — PC Agent (wygenerowany skrypt)
Pełna wersja narzędziowa: tools/pc-agent/esp32_pc_agent.py
Windows .exe: Releases → esp32-pc-agent.exe

Wymagania: pip install psutil requests
Uruchomienie:
  python esp32_pc_agent.py --host ${ipAddress} --port ${port}
"""
import argparse
import os
import shutil
import subprocess
import time
import psutil
import requests


def root_disk():
    return "C:\\\\" if os.name == "nt" else "/"


def gpu_percent():
    nvidia = shutil.which("nvidia-smi")
    if not nvidia:
        return 0
    try:
        out = subprocess.run(
            [nvidia, "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=2, check=False,
        )
        line = (out.stdout or "").strip().splitlines()
        return int(float(line[0])) if line else 0
    except Exception:
        return 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="${ipAddress}")
    p.add_argument("--port", type=int, default=${port})
    p.add_argument("--no-gpu", action="store_true")
    args = p.parse_args()
    url = f"http://{args.host}:{args.port}/api/pc-stats"
    print(f"ESP32 PC Agent -> {url}")
    print("Firewall Windows: zezwól na HTTP do IP ESP32 w LAN.")
    while True:
        try:
            payload = {
                "cpu": int(psutil.cpu_percent(interval=1)),
                "ram": int(psutil.virtual_memory().percent),
                "gpu": 0 if args.no_gpu else gpu_percent(),
                "disk": int(psutil.disk_usage(root_disk()).percent),
            }
            res = requests.post(url, json=payload, timeout=2)
            print(
                f"CPU {payload['cpu']}% RAM {payload['ram']}% "
                f"GPU {payload['gpu']}% DYSK {payload['disk']}% -> {res.status_code}"
            )
        except Exception as e:
            print(f"Oczekiwanie na ESP32: {e}")
        time.sleep(1)


if __name__ == "__main__":
    main()
`;
}

