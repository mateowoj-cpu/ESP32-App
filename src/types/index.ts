export type DisplayModel = 
  | 'ssd1306_128x64'
  | 'ssd1306_128x32'
  | 'sh1106_128x64'
  | 'st7789_240x240'
  | 'st7789_135x240'
  | 'ili9341_320x240'
  | 'gc9a01_240x240_round';

export type BusType = 'i2c' | 'spi';

export type DisplayTheme = 
  | 'oled_neon_blue'
  | 'oled_pure_white'
  | 'crt_amber'
  | 'terminal_green'
  | 'cyberpunk_cyan_pink'
  | 'ips_rgb_full'
  | 'epaper_bw';

export type WidgetFont = 
  | 'u8g2_8x13'
  | 'pixel_5x7'
  | 'tom_thumb'
  | 'jetbrains_mono'
  | 'press_start_2p'
  | 'sans_regular';

export type PetMood = 
  | 'neutral'
  | 'blink'
  | 'glance_left'
  | 'glance_right'
  | 'look_around'
  | 'look_up'
  | 'look_left'
  | 'look_right'
  | 'happy'
  | 'surprised'
  | 'yawn'
  | 'sleep'
  | 'crazy'
  | 'dizzy'
  | 'angry'
  | 'love';

export type PetBehaviorType = 
  | 'look_around'
  | 'look_up'
  | 'look_left'
  | 'look_right'
  | 'yawn'
  | 'sleep'
  | 'crazy'
  | 'dizzy'
  | 'blink'
  | 'happy'
  | 'surprised'
  | 'angry'
  | 'neutral';

export interface PetTimelineStep {
  id: string;
  behavior: PetBehaviorType;
  name: string;
  durationSec: number;
  description: string;
}

export type PetEyeStyle = 
  | 'robot_capsule'
  | 'cute_round'
  | 'pixel_arcade'
  | 'cyber_visor';

export type WidgetType = 
  | 'text'
  | 'cyber_pet'
  | 'clock'
  | 'gauge'
  | 'progress_bar'
  | 'sparkline'
  | 'weather'
  | 'pc_monitor'
  | 'menu'
  | 'battery_wifi'
  | 'icon';

export interface UIWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  font?: WidgetFont;
  fontSize?: number;
  textColor?: string;
  fillColor?: string;
  align?: 'left' | 'center' | 'right';
  binding?: WidgetBinding;
  sensorThreshold?: number; // Próg dla czujników analogowych (np. lux > 500)
  sensorActiveLabel?: string; // Etykieta dla stanu aktywnego (np. "RUCH!")
  sensorInactiveLabel?: string; // Etykieta dla stanu nieaktywnego (np. "Cisza")
  
  // Cyber pet specific
  petMood?: PetMood;
  petEyeStyle?: PetEyeStyle;
  
  // Clock specific
  clockFormat?: '24h' | '12h';
  showSeconds?: boolean;
  showDate?: boolean;
  
  // Gauge / Progress bar specific
  minVal?: number;
  maxVal?: number;
  unit?: string;
  showNumericValue?: boolean;
  orientation?: 'horizontal' | 'vertical';
  
  // Sparkline specific
  historyPoints?: number;
  
  // Menu specific
  menuTitle?: string;
  menuItems?: string[];
  selectedIndex?: number;
  
  // Icon specific
  iconName?: 'wifi' | 'battery' | 'cloud' | 'sun' | 'cpu' | 'alert' | 'heart' | 'bell' | 'thermometer' | 'settings';

  // Animation Sequence & Timing
  animationType?: WidgetAnimationType;
  animationDelayMs?: number; // Opóźnienie pojawienia się (ms), np. 0, 300, 600...
  animationDurationMs?: number; // Czas trwania animacji (ms), np. 400, 600, 800...
  sequenceOrder?: number; // Kolejność pojawiania się w sekwencji (1, 2, 3...)
  animationLoop?: WidgetAnimationLoop; // Efekt ciągły po wejściu
}

export type WidgetBinding = 
  | 'none'
  | 'pirActive'
  | 'ambientLux'
  | 'temperature'
  | 'humidity'
  | 'potAdc'
  | 'bootPressed'
  | 'userBtn1Pressed'
  | 'encoderVal'
  | 'usbConnected'
  | 'bluetoothConnected'
  | 'temp' // alias
  | 'lux' // alias
  | 'pot' // alias
  | 'pir' // alias
  | 'cpu'
  | 'ram'
  | 'gpu'
  | 'disk'
  | 'time'
  | 'date'
  | 'weather_summary'
  | 'weather_temp'
  | 'custom';

export type WidgetAnimationType = 
  | 'none'
  | 'fade_in'
  | 'slide_left'
  | 'slide_right'
  | 'slide_up'
  | 'slide_down'
  | 'zoom_in'
  | 'typewriter';

export type WidgetAnimationLoop =
  | 'none'
  | 'pulse'
  | 'blink'
  | 'bounce';

export interface Screen {
  id: string;
  name: string;
  widgets: UIWidget[];
  screenTransition?: 'instant' | 'fade' | 'slide' | 'wipe';
  animationSequenceEnabled?: boolean;
  totalSequenceDurationMs?: number;
}

export type TouchControllerType = 
  | 'none'
  | 'cst816s'
  | 'ft6236'
  | 'xpt2046'
  | 'gt911'
  | 'capacitive_gpio';

export interface DisplayConfig {
  model: DisplayModel;
  width: number;
  height: number;
  bus: BusType;
  i2cAddress: string;
  sdaPin: number;
  sclPin: number;
  mosiPin: number;
  sckPin: number;
  csPin: number;
  dcPin: number;
  rstPin: number;
  backlightPin: number;
  theme: DisplayTheme;
  pixelGridEffect: boolean;
  scanlineEffect: boolean;
  brightness: number; // 0 - 100
  // Touchscreen configuration
  touchEnabled: boolean;
  touchController: TouchControllerType;
  touchSdaPin: number;
  touchSclPin: number;
  touchIntPin: number;
  touchRstPin: number;
  touchInvertX: boolean;
  touchInvertY: boolean;
}

export type PinFunction = 
  | 'I2C_SDA'
  | 'I2C_SCL'
  | 'SPI_MOSI'
  | 'SPI_MISO'
  | 'SPI_SCK'
  | 'SPI_CS'
  | 'OLED_DC'
  | 'OLED_RST'
  | 'PWM_BACKLIGHT'
  | 'PWM_BUZZER'
  | 'PWM_SERVO'
  | 'TOUCH_SDA'
  | 'TOUCH_SCL'
  | 'TOUCH_INT'
  | 'TOUCH_RST'
  | 'ADC_LDR'
  | 'ADC_POT'
  | 'INPUT_PIR'
  | 'INPUT_BOOT'
  | 'INPUT_BUTTON'
  | 'OUTPUT_LED'
  | 'OUTPUT_RELAY'
  | 'UART_TX'
  | 'UART_RX'
  | 'GPIO_FREE';

export interface SystemConfig {
  wifiSsid: string;
  wifiPassword: string;
  /** Include ArduinoOTA + HTTP /update in generated sketch (Faza 9). */
  otaEnabled?: boolean;
  otaPassword?: string;
  /** ArduinoOTA port (default 3232). HTTP update uses WebServer port when enabled. */
  otaPort?: number;
  autoReconnect: boolean;
  mdnsName: string;
  deepSleepTimeoutSec: number; // 0 = disabled
  wakeOnMotion: boolean;
  wakePin: number;
  ntpServer: string;
  timezone: string;
  clockFormat?: '24h' | '12h';
  autoBrightnessEnabled?: boolean;
  cpuFrequencyMhz: 80 | 160 | 240;
  // Hardware Sensor & Peripheral Pin Assignments
  pirPin?: number;
  ldrPin?: number;
  potPin?: number;
  userBtn1Pin?: number;
  buzzerPin?: number;
  ledPin?: number;
  customPinFunctions?: Record<number, PinFunction>;
  
  // USB-C Auto-Switch to PC Resource Monitor
  usbAutoSwitchToPcMonitor: boolean;
  usbSwitchScreenIndex: number;
  usbDisconnectRevertScreen: boolean;
  usbDetectMethod: 'serial_handshake' | 'cdc_dtr' | 'vbus_power';

  // Bluetooth Configuration
  bluetoothEnabled: boolean;
  bluetoothMode: 'disabled' | 'ble' | 'classic_spp' | 'ble_keyboard';
  bluetoothDeviceName: string;
  bleAdvertising: boolean;
  bleServiceType: 'pc_telemetry' | 'serial_spp' | 'battery_env';
  blePairingPin: string;
  bleTxPower: number; // -12 to 9 dBm
}

export type WeatherApiProvider = 'open-meteo' | 'wttr-in' | 'openweathermap' | 'custom';

export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  pressure?: number;
  icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'thunder';
  lastUpdated: string;
}

export interface PCStatsData {
  cpuUsage: number;
  ramUsage: number;
  gpuUsage: number;
  diskUsage: number; // Zajętość dysku %
  cpuTemp: number;
  netSpeedKb: number;
  isStreaming: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  priority: 'normal' | 'urgent';
}

export interface ApiIntegrationsConfig {
  weather: {
    enabled: boolean;
    provider: WeatherApiProvider;
    city: string;
    latitude: number;
    longitude: number;
    apiKey?: string;
    customEndpoint?: string;
    unit: 'celsius' | 'fahrenheit';
    refreshIntervalMin: number;
    data: WeatherData;
  };
  pcMonitor: {
    enabled: boolean;
    port: number;
    data: PCStatsData;
  };
  notifications: {
    enabled: boolean;
    autoPopup: boolean;
    displayDurationSec: number;
    list: NotificationItem[];
  };
}

export type TriggerType = 
  | 'pir_motion'
  | 'light_lux_below'
  | 'temp_above'
  | 'boot_button_pressed'
  | 'gpio_button_pressed'
  | 'time_is'
  | 'notification_received'
  | 'rotary_turned'
  | 'screen_touch_tap'
  | 'screen_touch_swipe'
  | 'usb_connected'
  | 'usb_disconnected'
  | 'bluetooth_connected';

export type ActionType = 
  | 'switch_screen'
  | 'wake_display'
  | 'set_pet_mood'
  | 'set_brightness'
  | 'sound_buzzer'
  | 'show_notification';

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: TriggerType;
    threshold?: number;
    time?: string; // "23:00"
    gpioPin?: number;
    touchZone?: 'left' | 'right' | 'center' | 'any';
  };
  action: {
    type: ActionType;
    targetScreenId?: string;
    petMood?: PetMood;
    brightness?: number;
    frequencyHz?: number;
    durationMs?: number;
    alertMessage?: string;
  };
}

export type GpioMode = 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT' | 'ADC' | 'I2C_SPI' | 'SYSTEM';
export type GpioLevel = 'HIGH' | 'LOW';

export interface GpioPinState {
  pin: number;
  label: string;
  mode: GpioMode;
  level: GpioLevel;
  voltage: number; // 0.0 to 3.3
  isPwm?: boolean;
  dutyPercent?: number;
  assignedRole?: string;
  isInputOnly?: boolean;
}

export interface HardwareSimState {
  pirActive: boolean;
  ambientLux: number; // 0 - 1000
  temperature: number; // °C
  humidity: number; // %
  potAdc: number; // 0 - 4095
  bootPressed: boolean;
  userBtn1Pressed: boolean;
  userBtn2Pressed: boolean;
  encoderVal: number;
  encoderPressed: boolean;
  simulatedTime: string; // HH:MM:SS
  simulatedDate: string; // YYYY-MM-DD
  isDisplayAwake: boolean;
  currentScreenIndex: number;
  activePetMood: PetMood;
  lastTriggerFired: string | null;
  // Touch simulation
  touchActive: boolean;
  touchX: number;
  touchY: number;
  touchGesture: 'none' | 'tap' | 'swipe_left' | 'swipe_right' | 'long_press';
  // USB & Bluetooth simulation state
  usbConnected: boolean;
  bluetoothConnected: boolean;
  previousScreenBeforeUsb?: number;
  // GPIO Pin Monitor & Injector
  gpioOverrides?: Record<number, GpioLevel>;
}

export type Esp32Family = 
  | 'ESP32'
  | 'ESP32-S3'
  | 'ESP32-C3'
  | 'ESP32-S2'
  | 'ESP32-C6'
  | 'Nieznany / Generic';

export interface ConnectedEsp32Info {
  connected: boolean;
  portName?: string;
  usbVendorId?: string;
  usbProductId?: string;
  chipFamily: Esp32Family;
  chipModel: string;
  coreCount: number;
  architecture: string;
  maxCpuClockMhz: number;
  flashSizeMb: number;
  psramSizeMb: number;
  macAddress: string;
  baudRate: number;
  features: string[];
  /** Optional i18n keys; UI should prefer these over raw `features` when present. */
  featureKeys?: string[];
  rawBootLog?: string;
}

export interface SerialLogMessage {
  id: string;
  timestamp: string;
  text: string;
  direction: 'rx' | 'tx' | 'system';
}

