/** Formats a kgCO2e value into the most legible unit (g / kg / t) for display. */
export function formatKgCo2e(kg: number): string {
  const abs = Math.abs(kg);
  if (abs === 0) return "0 g CO2e";
  if (abs < 1) return `${(kg * 1000).toFixed(1)} g CO2e`;
  if (abs < 1000) return `${kg.toFixed(3)} kg CO2e`;
  return `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t CO2e`;
}

export function formatRange(low?: number, high?: number): string | null {
  if (low === undefined || high === undefined) return null;
  return `${formatKgCo2e(low)} – ${formatKgCo2e(high)}`;
}

export function formatUses(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
