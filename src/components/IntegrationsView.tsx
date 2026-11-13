import React, { useEffect, useState } from 'react';
import { ApiIntegrationsConfig, HardwareSimState, NotificationItem, WeatherApiProvider } from '../types';
import { 
  CloudSun, 
  Cpu, 
  Bell, 
  RefreshCw, 
  Send, 
  Download, 
  Terminal, 
  CheckCircle, 
  Flame, 
  Wifi, 
  Server,
  Search,
  Globe,
  Key,
  MapPin,
  Wind,
  Droplets,
  Gauge,
  ExternalLink,
  Sliders,
  Check,
  Play,
  Square,
} from 'lucide-react';
import { generatePythonPcAgentScript } from '../utils/codeGenerator';
import type { PcAgentInfo } from '../platform/pcAgent';
import { useLocale } from '../i18n/LocaleContext';

interface IntegrationsViewProps {
  apiConfig: ApiIntegrationsConfig;
  setApiConfig: React.Dispatch<React.SetStateAction<ApiIntegrationsConfig>>;
  simState: HardwareSimState;
  setSimState: React.Dispatch<React.SetStateAction<HardwareSimState>>;
}

export const POPULAR_CITIES: Record<string, { lat: number; lon: number; country: string; label: string }> = {
  'Dortmund': { lat: 51.5136, lon: 7.4653, country: 'DE', label: 'Dortmund (Niemcy)' },
  'Warszawa': { lat: 52.2297, lon: 21.0122, country: 'PL', label: 'Warszawa (Polska)' },
  'Kraków': { lat: 50.0647, lon: 19.9450, country: 'PL', label: 'Kraków (Polska)' },
  'Wrocław': { lat: 51.1079, lon: 17.0385, country: 'PL', label: 'Wrocław (Polska)' },
  'Gdańsk': { lat: 54.3520, lon: 18.6466, country: 'PL', label: 'Gdańsk (Polska)' },
  'Poznań': { lat: 52.4064, lon: 16.9252, country: 'PL', label: 'Poznań (Polska)' },
  'Katowice': { lat: 50.2649, lon: 19.0238, country: 'PL', label: 'Katowice (Polska)' },
  'Berlin': { lat: 52.5200, lon: 13.4050, country: 'DE', label: 'Berlin (Niemcy)' },
  'Monachium': { lat: 48.1351, lon: 11.5820, country: 'DE', label: 'Monachium (Niemcy)' },
  'Kolonia': { lat: 50.9375, lon: 6.9603, country: 'DE', label: 'Kolonia / Köln (Niemcy)' },
  'Frankfurt': { lat: 50.1109, lon: 8.6821, country: 'DE', label: 'Frankfurt (Niemcy)' },
  'Hamburg': { lat: 53.5511, lon: 9.9937, country: 'DE', label: 'Hamburg (Niemcy)' },
  'Londyn': { lat: 51.5074, lon: -0.1278, country: 'GB', label: 'Londyn (Wlk. Brytania)' },
  'Paryż': { lat: 48.8566, lon: 2.3522, country: 'FR', label: 'Paryż (Francja)' },
  'Wiedeń': { lat: 48.2082, lon: 16.3738, country: 'AT', label: 'Wiedeń (Austria)' },
  'Praga': { lat: 50.0755, lon: 14.4378, country: 'CZ', label: 'Praga (Czechy)' },
  'Nowy Jork': { lat: 40.7128, lon: -74.0060, country: 'US', label: 'Nowy Jork (USA)' },
  'Tokio': { lat: 35.6762, lon: 139.6503, country: 'JP', label: 'Tokio (Japonia)' },
};

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  apiConfig,
  setApiConfig,
  simState,
  setSimState,
}) => {
  const { t } = useLocale();
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherFetchStatus, setWeatherFetchStatus] = useState<string | null>(null);

  // City Search via free Open-Meteo Geocoding
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; country: string; admin1?: string; latitude: number; longitude: number }>>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Notification input
  const [notifTitle, setNotifTitle] = useState('Nowa wiadomość');
  const [notifMessage, setNotifMessage] = useState('Ktoś dzwoni do drzwi wejściowych!');

  // PC agent (Tauri desktop)
  const [esp32Host, setEsp32Host] = useState('192.168.1.150');
  const [pcAgentInfo, setPcAgentInfo] = useState<PcAgentInfo | null>(null);
  const [pcAgentBusy, setPcAgentBusy] = useState(false);
  const [pcAgentMessage, setPcAgentMessage] = useState<string | null>(null);
  const [isTauriHost, setIsTauriHost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        if (!isTauri() || cancelled) return;
        setIsTauriHost(true);
        const { getPcAgentInfo } = await import('../platform/pcAgent');
        const info = await getPcAgentInfo();
        if (!cancelled) setPcAgentInfo(info);
      } catch {
        // browser / no plugin
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Search cities online (Free Open-Meteo Geocoding API)
  const handleSearchOnlineCity = async (query: string) => {
    if (!query.trim() || query.length < 2) return;
    setIsSearchingCity(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=pl&format=json`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setShowSearchDropdown(true);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Błąd wyszukiwania miasta:', err);
    } finally {
      setIsSearchingCity(false);
    }
  };

  // Select city from geocoding search results
  const handleSelectSearchResult = (result: { name: string; country: string; latitude: number; longitude: number }) => {
    const cityName = result.name;
    setApiConfig(prev => ({
      ...prev,
      weather: {
        ...prev.weather,
        city: cityName,
        latitude: result.latitude,
        longitude: result.longitude,
      },
    }));
    setShowSearchDropdown(false);
    setCitySearchQuery('');
    fetchWeatherForCoords(result.latitude, result.longitude, cityName, apiConfig.weather.provider || 'open-meteo');
  };

  // Select preset city
  const handleSelectPresetCity = (cityKey: string) => {
    const found = POPULAR_CITIES[cityKey];
    if (!found) return;
    setApiConfig(prev => ({
      ...prev,
      weather: {
        ...prev.weather,
        city: cityKey,
        latitude: found.lat,
        longitude: found.lon,
      },
    }));
    fetchWeatherForCoords(found.lat, found.lon, cityKey, apiConfig.weather.provider || 'open-meteo');
  };

  // Change weather API provider
  const handleProviderChange = (provider: WeatherApiProvider) => {
    setApiConfig(prev => ({
      ...prev,
      weather: {
        ...prev.weather,
        provider,
      },
    }));
  };

  // Real live fetch based on selected free API provider
  const fetchWeatherForCoords = async (
    lat: number,
    lon: number,
    cityName: string,
    provider: WeatherApiProvider,
    apiKey?: string,
    customUrl?: string
  ) => {
    setIsFetchingWeather(true);
    setWeatherFetchStatus(null);
    try {
      let temperature = 18.0;
      let humidity = 60;
      let windSpeed = 12;
      let pressure = 1013;
      let condition = 'Słonecznie';
      let icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'thunder' = 'sun';

      if (provider === 'wttr-in') {
        // Free wttr.in API (directly by city name, e.g. Dortmund)
        const res = await fetch(`https://wttr.in/${encodeURIComponent(cityName)}?format=j1`);
        if (!res.ok) throw new Error('Błąd połączenia z bezpłatnym wttr.in');
        const data = await res.json();
        const current = data.current_condition?.[0];
        if (current) {
          temperature = parseFloat(current.temp_C);
          humidity = parseInt(current.humidity, 10);
          windSpeed = parseInt(current.windspeedKmph, 10);
          pressure = parseInt(current.pressure, 10);
          const desc = current.weatherDesc?.[0]?.value || 'Pogodnie';
          condition = desc;
          const lower = desc.toLowerCase();
          if (lower.includes('rain') || lower.includes('deszcz')) icon = 'rain';
          else if (lower.includes('cloud') || lower.includes('chmury') || lower.includes('overcast')) icon = 'cloud';
          else if (lower.includes('snow') || lower.includes('śnieg')) icon = 'snow';
          else if (lower.includes('thunder') || lower.includes('burza')) icon = 'thunder';
          else icon = 'sun';
        }
      } else if (provider === 'openweathermap') {
        const key = apiKey || apiConfig.weather.apiKey;
        if (!key) {
          throw new Error('OpenWeatherMap wymaga bezpłatnego klucza API (lub przełącz na darmowe Open-Meteo / wttr.in)');
        }
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${key}`
        );
        if (!res.ok) throw new Error(`Błąd OpenWeatherMap (${res.status}): Sprawdź poprawność klucza`);
        const data = await res.json();
        temperature = data.main.temp;
        humidity = data.main.humidity;
        pressure = data.main.pressure;
        windSpeed = Math.round((data.wind?.speed || 0) * 3.6);
        condition = data.weather?.[0]?.description || 'Pogodnie';
        const main = data.weather?.[0]?.main?.toLowerCase() || '';
        if (main.includes('rain')) icon = 'rain';
        else if (main.includes('cloud')) icon = 'cloud';
        else if (main.includes('snow')) icon = 'snow';
        else if (main.includes('thunder')) icon = 'thunder';
        else icon = 'sun';
      } else if (provider === 'custom') {
        const targetUrl = customUrl || apiConfig.weather.customEndpoint || `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error('Błąd połączenia z własnym adresem URL');
        const data = await res.json();
        if (data.current_weather) {
          temperature = data.current_weather.temperature;
          windSpeed = data.current_weather.windspeed;
        } else if (data.temperature !== undefined) {
          temperature = data.temperature;
        }
      } else {
        // Open-Meteo (default, 100% free, no API key needed)
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,surface_pressure`
        );
        if (!res.ok) throw new Error('Błąd połączenia z Open-Meteo');
        const data = await res.json();
        const current = data.current_weather;
        temperature = current.temperature;
        windSpeed = current.windspeed;
        const code = current.weathercode;
        if (code === 0) { condition = 'Czyste niebo (Słonecznie)'; icon = 'sun'; }
        else if (code <= 3) { condition = 'Częściowe zachmurzenie'; icon = 'cloud'; }
        else if (code >= 51 && code <= 67) { condition = 'Opady deszczu'; icon = 'rain'; }
        else if (code >= 71 && code <= 77) { condition = 'Opady śniegu'; icon = 'snow'; }
        else if (code >= 95) { condition = 'Burza z piorunami'; icon = 'thunder'; }
        else { condition = 'Pochmurno'; icon = 'cloud'; }

        if (data.hourly && data.hourly.relativehumidity_2m && data.hourly.relativehumidity_2m.length > 0) {
          humidity = data.hourly.relativehumidity_2m[0];
        }
        if (data.hourly && data.hourly.surface_pressure && data.hourly.surface_pressure.length > 0) {
          pressure = Math.round(data.hourly.surface_pressure[0]);
        }
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setApiConfig(prev => ({
        ...prev,
        weather: {
          ...prev.weather,
          city: cityName,
          latitude: lat,
          longitude: lon,
          data: {
            city: cityName,
            temperature,
            condition,
            humidity,
            windSpeed,
            pressure,
            icon,
            lastUpdated: timeStr,
          },
        },
      }));

      // Update hardware simulator temperature & humidity
      setSimState(prev => ({
        ...prev,
        temperature,
        humidity,
        lastTriggerFired: `Pobrano pogodę (${provider}) dla ${cityName}: ${temperature.toFixed(1)}°C`,
      }));

      setWeatherFetchStatus(`Pomyślnie zaktualizowano (${cityName}): ${temperature.toFixed(1)}°C, ${condition}!`);
    } catch (err: any) {
      setWeatherFetchStatus(`Błąd: ${err.message || 'Nie udało się pobrać danych'}`);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleFetchCurrentWeather = () => {
    fetchWeatherForCoords(
      apiConfig.weather.latitude,
      apiConfig.weather.longitude,
      apiConfig.weather.city,
      apiConfig.weather.provider || 'open-meteo',
      apiConfig.weather.apiKey,
      apiConfig.weather.customEndpoint
    );
  };

  // Dispatch test notification
  const handleSendNotification = () => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: notifTitle,
      message: notifMessage,
      time: timeStr,
      priority: 'normal',
    };

    setApiConfig(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        list: [newNotif, ...prev.notifications.list.slice(0, 4)],
      },
    }));

    setSimState(prev => ({
      ...prev,
      isDisplayAwake: true,
      lastTriggerFired: 'Powiadomienie',
    }));
  };

  // Download Python PC agent script
  const handleDownloadPythonAgent = () => {
    const script = generatePythonPcAgentScript(esp32Host, apiConfig.pcMonitor.port);
    const blob = new Blob([script], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'esp32_pc_agent.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefreshPcAgent = async () => {
    setPcAgentBusy(true);
    setPcAgentMessage(null);
    try {
      const { getPcAgentInfo } = await import('../platform/pcAgent');
      setPcAgentInfo(await getPcAgentInfo());
    } catch (err) {
      setPcAgentMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPcAgentBusy(false);
    }
  };

  const handleStartPcAgent = async () => {
    setPcAgentBusy(true);
    setPcAgentMessage(null);
    try {
      const { startPcAgent } = await import('../platform/pcAgent');
      const info = await startPcAgent(esp32Host.trim() || '192.168.1.150', apiConfig.pcMonitor.port);
      setPcAgentInfo(info);
      setPcAgentMessage(info.hint);
    } catch (err) {
      setPcAgentMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPcAgentBusy(false);
    }
  };

  const handleStopPcAgent = async () => {
    setPcAgentBusy(true);
    setPcAgentMessage(null);
    try {
      const { stopPcAgent, getPcAgentInfo } = await import('../platform/pcAgent');
      await stopPcAgent();
      setPcAgentInfo(await getPcAgentInfo());
      setPcAgentMessage('Agent PC zatrzymany.');
    } catch (err) {
      setPcAgentMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPcAgentBusy(false);
    }
  };

  const currentProvider = apiConfig.weather.provider || 'open-meteo';

  return (
    <div className="flex flex-col gap-6">
      {/* 3 Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. API Pogody w Czasie Rzeczywistym (Z obsługą miast jak Dortmund i bezpłatnych API) */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-5 shadow-xl">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <CloudSun className="w-4 h-4 text-amber-400" />
                {t('integ.weather')}
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                currentProvider === 'open-meteo' || currentProvider === 'wttr-in'
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                  : 'text-cyan-400 bg-cyan-950/60 border-cyan-800'
              }`}>
                {currentProvider === 'open-meteo' || currentProvider === 'wttr-in' ? '100% BEZ KLUCZA' : 'DARMOWY PLAN'}
              </span>
            </div>

            {/* Provider Selector Tabs */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1.5">
                Dostawca bezpłatnego API pogodowego:
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono">
                <button
                  onClick={() => handleProviderChange('open-meteo')}
                  className={`px-2 py-1.5 rounded-lg transition-all text-left flex items-center justify-between ${
                    currentProvider === 'open-meteo'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>Open-Meteo</span>
                  {currentProvider === 'open-meteo' && <Check className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleProviderChange('wttr-in')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-left flex items-center justify-between ${
                    currentProvider === 'wttr-in'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>wttr.in</span>
                  {currentProvider === 'wttr-in' && <Check className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleProviderChange('openweathermap')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-left flex items-center justify-between ${
                    currentProvider === 'openweathermap'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>OpenWeather</span>
                  {currentProvider === 'openweathermap' && <Check className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleProviderChange('custom')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-left flex items-center justify-between ${
                    currentProvider === 'custom'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>Własny REST</span>
                  {currentProvider === 'custom' && <Check className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* City Preset Selection with Dortmund */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Wybierz miasto z listy:</label>
                <span className="text-[10px] text-amber-400 font-mono">Dortmund & Europa</span>
              </div>
              <select
                value={POPULAR_CITIES[apiConfig.weather.city] ? apiConfig.weather.city : ''}
                onChange={e => handleSelectPresetCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 font-medium"
              >
                <option value="" disabled>-- Wybierz miasto lub wyszukaj poniżej --</option>
                {Object.entries(POPULAR_CITIES).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Online City Geocoding Search Input */}
            <div className="relative">
              <label className="text-[11px] text-slate-400 block mb-1">
                Wyszukaj dowolne miasto na świecie (Online Geocoding):
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={citySearchQuery}
                    placeholder="Wpisz np. Dortmund, Essen, Zakopane, Rzym..."
                    onChange={e => {
                      setCitySearchQuery(e.target.value);
                      if (e.target.value.length >= 2) {
                        handleSearchOnlineCity(e.target.value);
                      } else {
                        setShowSearchDropdown(false);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSearchOnlineCity(citySearchQuery);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-amber-400"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchOnlineCity(citySearchQuery)}
                  disabled={isSearchingCity}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  {isSearchingCity ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Szukaj'}
                </button>
              </div>

              {/* Autocomplete Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-amber-500/50 rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-800 text-xs">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSearchResult(result)}
                      className="w-full px-3 py-2 text-left hover:bg-amber-950/40 hover:text-amber-300 flex items-center justify-between text-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-semibold">{result.name}</span>
                        {result.admin1 && <span className="text-xs text-slate-400">({result.admin1})</span>}
                      </div>
                      <span className="text-xs font-mono text-slate-400 uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {result.country} · {result.latitude.toFixed(2)}°, {result.longitude.toFixed(2)}°
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Provider Specific Options (API Key / Custom URL) */}
            {currentProvider === 'openweathermap' && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-cyan-400" />
                    Klucz OpenWeatherMap API:
                  </label>
                  <a
                    href="https://openweathermap.org/api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>Darmowe konto</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <input
                  type="password"
                  value={apiConfig.weather.apiKey || ''}
                  placeholder="Wklej darmowy klucz API (np. abc123xyz...)"
                  onChange={e => setApiConfig(prev => ({
                    ...prev,
                    weather: { ...prev.weather, apiKey: e.target.value },
                  }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            )}

            {currentProvider === 'custom' && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                <label className="text-xs font-mono text-slate-300">Własny adres URL JSON:</label>
                <input
                  type="text"
                  value={apiConfig.weather.customEndpoint || ''}
                  placeholder="http://homeassistant.local:8123/api/..."
                  onChange={e => setApiConfig(prev => ({
                    ...prev,
                    weather: { ...prev.weather, customEndpoint: e.target.value },
                  }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            )}

            {/* Live Weather Display Card */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold font-mono text-amber-300 flex items-center gap-2">
                    <span>{apiConfig.weather.data.temperature.toFixed(1)} °C</span>
                    <span className="text-xl">
                      {apiConfig.weather.data.icon === 'sun' ? '☀️' : 
                       apiConfig.weather.data.icon === 'cloud' ? '⛅' : 
                       apiConfig.weather.data.icon === 'rain' ? '🌧️' : 
                       apiConfig.weather.data.icon === 'snow' ? '❄️' : '⛈️'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>{apiConfig.weather.city}</span>
                    <span className="text-slate-400 font-normal">· {apiConfig.weather.data.condition}</span>
                  </div>
                </div>
                <div className="text-right text-xs font-mono text-slate-400">
                  <div className="text-emerald-400 font-semibold">{currentProvider.toUpperCase()}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Aktualizacja: {apiConfig.weather.data.lastUpdated}</div>
                </div>
              </div>

              {/* Extended Metrics: Wind, Humidity, Pressure */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-300">
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{apiConfig.weather.data.windSpeed} km/h</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{apiConfig.weather.data.humidity}% wilg.</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{apiConfig.weather.data.pressure ?? 1016} hPa</span>
                </div>
              </div>
            </div>

            {/* Refresh interval on ESP32 */}
            <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Odświeżanie na ESP32:</span>
              <select
                value={apiConfig.weather.refreshIntervalMin}
                onChange={e => setApiConfig(prev => ({
                  ...prev,
                  weather: { ...prev.weather, refreshIntervalMin: Number(e.target.value) },
                }))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
              >
                <option value={5}>Co 5 minut</option>
                <option value={15}>Co 15 minut</option>
                <option value={30}>Co 30 minut</option>
                <option value={60}>Co 1 godzinę</option>
              </select>
            </div>

            {weatherFetchStatus && (
              <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300">
                {weatherFetchStatus}
              </div>
            )}
          </div>

          <button
            onClick={handleFetchCurrentWeather}
            disabled={isFetchingWeather}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${isFetchingWeather ? 'animate-spin' : ''}`} />
            <span>Pobierz Dane Live ({apiConfig.weather.city}) do Symulatora</span>
          </button>
        </div>

        {/* 2. Monitor Zasobów Komputera (PC Hardware Monitor) */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-5 shadow-xl">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                {t('integ.pc')}
              </h3>
              <span className="text-[10px] font-mono text-cyan-400">
                PORT {apiConfig.pcMonitor.port}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              ESP32 uruchamia wbudowany lekki serwer HTTP REST (<code>/api/pc-stats</code>). Agent na PC przesyła parametry CPU, RAM, GPU i dysku.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-slate-400">Adres IP ESP32 (LAN):</label>
              <input
                type="text"
                value={esp32Host}
                onChange={e => setEsp32Host(e.target.value)}
                placeholder="192.168.1.150"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Firewall Windows: zezwól na ruch HTTP z <code>esp32-pc-agent.exe</code> do tego IP.
              </p>
            </div>

            {isTauriHost && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">Agent .exe (Tauri)</span>
                  <span className={`font-mono ${pcAgentInfo?.running ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {pcAgentInfo?.running ? 'DZIAŁA' : pcAgentInfo?.available ? 'GOTOWY' : 'BRAK .EXE'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {pcAgentInfo?.hint || 'Sprawdzanie zasobów aplikacji…'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pcAgentBusy || !pcAgentInfo?.available || pcAgentInfo?.running}
                    onClick={() => void handleStartPcAgent()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start
                  </button>
                  <button
                    type="button"
                    disabled={pcAgentBusy || !pcAgentInfo?.running}
                    onClick={() => void handleStopPcAgent()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stop
                  </button>
                  <button
                    type="button"
                    disabled={pcAgentBusy}
                    onClick={() => void handleRefreshPcAgent()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 text-slate-300 border border-slate-800"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pcAgentBusy ? 'animate-spin' : ''}`} />
                    Odśwież
                  </button>
                </div>
                {pcAgentMessage && (
                  <p className="text-[10px] font-mono text-cyan-300/90">{pcAgentMessage}</p>
                )}
              </div>
            )}

            {/* Simulated PC Stats Sliders */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Użycie CPU:</span>
                  <span className="font-mono text-cyan-400 font-bold">{apiConfig.pcMonitor.data.cpuUsage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={apiConfig.pcMonitor.data.cpuUsage}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setApiConfig(prev => ({
                      ...prev,
                      pcMonitor: {
                        ...prev.pcMonitor,
                        data: { ...prev.pcMonitor.data, cpuUsage: val },
                      },
                    }));
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Użycie RAM:</span>
                  <span className="font-mono text-cyan-400 font-bold">{apiConfig.pcMonitor.data.ramUsage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={apiConfig.pcMonitor.data.ramUsage}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setApiConfig(prev => ({
                      ...prev,
                      pcMonitor: {
                        ...prev.pcMonitor,
                        data: { ...prev.pcMonitor.data, ramUsage: val },
                      },
                    }));
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Użycie GPU:</span>
                  <span className="font-mono text-cyan-400 font-bold">{apiConfig.pcMonitor.data.gpuUsage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={apiConfig.pcMonitor.data.gpuUsage}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setApiConfig(prev => ({
                      ...prev,
                      pcMonitor: {
                        ...prev.pcMonitor,
                        data: { ...prev.pcMonitor.data, gpuUsage: val },
                      },
                    }));
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Zajętość Dysku (HDD/SSD):</span>
                  <span className="font-mono text-cyan-400 font-bold">{apiConfig.pcMonitor.data.diskUsage ?? 64}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={apiConfig.pcMonitor.data.diskUsage ?? 64}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setApiConfig(prev => ({
                      ...prev,
                      pcMonitor: {
                        ...prev.pcMonitor,
                        data: { ...prev.pcMonitor.data, diskUsage: val },
                      },
                    }));
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleDownloadPythonAgent}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Pobierz Agenta PC (.py)</span>
            </button>
            <a
              href="https://github.com/mateowoj-cpu/ESP32-App/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Pobierz esp32-pc-agent.exe (Releases)</span>
            </a>
          </div>
        </div>

        {/* 3. Powiadomienia w Czasie Rzeczywistym */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-5 shadow-xl">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                {t('integ.notify')}
              </h3>
              <span className="text-[10px] font-mono text-emerald-400">
                HTTP PUSH
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Wysyłaj komunikaty na ekran ESP32 przez HTTP POST (<code>/api/notify</code>) ze smartfona, Home Assistant lub webhooków!
            </p>

            <div className="flex flex-col gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Tytuł powiadomienia:</label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={e => setNotifTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Treść wiadomości:</label>
                <textarea
                  value={notifMessage}
                  onChange={e => setNotifMessage(e.target.value)}
                  rows={2}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-400">Czas wyświetlania banera:</span>
              <strong className="text-emerald-400 ml-1 font-mono">{apiConfig.notifications.displayDurationSec} sekund</strong>
            </div>
          </div>

          <button
            onClick={handleSendNotification}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>Wyślij Testowe Powiadomienie na Ekran</span>
          </button>
        </div>
      </div>
    </div>
  );
};
