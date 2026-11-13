/** Lightweight host validation shared by UI / unit tests (mirrors Rust ota.rs checks). */
export function looksLikeHost(host: string): boolean {
  const h = host.trim();
  if (!h) return false;
  if (h.includes(' ')) return false;
  const parts = h.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p) && Number(p) <= 255)) {
    return true;
  }
  return h.includes('.');
}
