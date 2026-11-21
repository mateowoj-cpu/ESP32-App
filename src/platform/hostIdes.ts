/**
 * Host IDE install catalog — official download / Marketplace / allowlisted winget only.
 * Never points at unofficial mirrors or silent EXE downloads.
 */

export type HostIdeId =
  | 'arduino-ide'
  | 'vscode-platformio'
  | 'sloeber'
  | 'b4r';

export interface HostIdeInstallInfo {
  id: HostIdeId;
  /** Matches ToolProbe.id from get_external_tools_status */
  probeId: string;
  labelKey: string;
  hintKey: string;
  /** Official vendor download / docs page */
  downloadUrl: string;
  /** Allowlisted winget package id (Windows only); never arbitrary */
  wingetId: string | null;
  /** Optional VS Code Marketplace extension */
  extensionId?: string;
  extensionUrl?: string;
}

/** Curated allowlist mirrored in src-tauri/src/host_ides.rs */
export const WINGET_ALLOWLIST = [
  'ArduinoSA.IDE.stable',
  'Microsoft.VisualStudioCode',
] as const;

export const HOST_IDE_CATALOG: HostIdeInstallInfo[] = [
  {
    id: 'arduino-ide',
    probeId: 'arduino-ide',
    labelKey: 'desktop.ides.arduino',
    hintKey: 'desktop.ides.arduinoHint',
    downloadUrl: 'https://www.arduino.cc/en/software',
    wingetId: 'ArduinoSA.IDE.stable',
  },
  {
    id: 'vscode-platformio',
    probeId: 'vscode-platformio',
    labelKey: 'desktop.ides.vscodePio',
    hintKey: 'desktop.ides.vscodePioHint',
    downloadUrl: 'https://code.visualstudio.com/',
    wingetId: 'Microsoft.VisualStudioCode',
    extensionId: 'platformio.platformio-ide',
    extensionUrl:
      'https://marketplace.visualstudio.com/items?itemName=platformio.platformio-ide',
  },
  {
    id: 'sloeber',
    probeId: 'sloeber',
    labelKey: 'desktop.ides.sloeber',
    hintKey: 'desktop.ides.sloeberHint',
    downloadUrl: 'https://eclipse.baeyens.it/',
    wingetId: null,
  },
  {
    id: 'b4r',
    probeId: 'b4r',
    labelKey: 'desktop.ides.b4r',
    hintKey: 'desktop.ides.b4rHint',
    downloadUrl: 'https://www.b4x.com/b4r.html',
    wingetId: null,
  },
];

export function isWingetAllowlisted(packageId: string): boolean {
  return (WINGET_ALLOWLIST as readonly string[]).includes(packageId.trim());
}

export function getHostIdeByProbeId(probeId: string): HostIdeInstallInfo | undefined {
  return HOST_IDE_CATALOG.find(ide => ide.probeId === probeId);
}

export function wingetInstallCommand(packageId: string): string {
  return `winget install --id ${packageId} -e --source winget`;
}
