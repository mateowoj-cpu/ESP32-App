import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {setSerialAdapter} from './platform';
import {LocaleProvider} from './i18n/LocaleContext';
import {loadLocale} from './i18n/locales';

async function bootstrap() {
  document.documentElement.lang = loadLocale();

  try {
    const {isTauri} = await import('@tauri-apps/api/core');
    if (isTauri()) {
      const {createNativeSerialAdapter} = await import('./platform/nativeSerial');
      setSerialAdapter(createNativeSerialAdapter());
    }
  } catch {
    // Browser / non-Tauri — keep default Web Serial resolution.
  }

  createRoot(document.getElementById('root')!).render(
    <LocaleProvider>
      <App />
    </LocaleProvider>,
  );

  void import('./platform/telemetry').then(m => m.trackTelemetry({ name: 'app_open' }));
}

void bootstrap();
