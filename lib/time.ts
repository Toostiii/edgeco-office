/**
 * Wandelt "1:30" oder "1,5" / "1.5" in Minuten um.
 */
export function parseDurationToMinutes(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const colon = s.match(/^(\d+):([0-5]?\d)$/);
  if (colon) {
    return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  }
  const decimal = Number(s.replace(",", "."));
  if (Number.isFinite(decimal) && decimal >= 0) {
    return Math.round(decimal * 60);
  }
  return null;
}
