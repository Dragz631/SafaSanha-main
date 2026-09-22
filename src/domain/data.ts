/** Data LOCAL (YYYY-MM-DD). `toISOString()` é UTC e vira o dia às 21h no Brasil (UTC-3). */
export function dataLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}
