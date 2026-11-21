import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pcAgentCanonicalPath = path.resolve(rootDir, 'tools/pc-agent/esp32_pc_agent.py');
const pcAgentCanonical = fs.readFileSync(pcAgentCanonicalPath, 'utf8');

export default defineConfig(() => {
  return {
    // Avoid clearing the terminal when Tauri runs the Vite beforeDevCommand.
    clearScreen: false,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    define: {
      // Single PC-agent source artifact for UI download (host/port remain CLI params).
      __PC_AGENT_CANONICAL__: JSON.stringify(pcAgentCanonical),
    },
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    envPrefix: ['VITE_', 'TAURI_'],
  };
});
