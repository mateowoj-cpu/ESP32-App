import { invoke } from '@tauri-apps/api/core';

export interface PcAgentInfo {
  available: boolean;
  path?: string | null;
  running: boolean;
  hint: string;
}

export async function getPcAgentInfo(): Promise<PcAgentInfo> {
  return invoke<PcAgentInfo>('get_pc_agent_info');
}

export async function startPcAgent(host: string, port: number): Promise<PcAgentInfo> {
  return invoke<PcAgentInfo>('start_pc_agent', { host, port });
}

export async function stopPcAgent(): Promise<boolean> {
  return invoke<boolean>('stop_pc_agent');
}
