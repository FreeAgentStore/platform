/**
 * Unit conversion heuristic — pure JS, no model needed.
 * Covers: length, weight, temperature, volume, speed, data, time.
 */

type Category = 'length' | 'weight' | 'temperature' | 'volume' | 'speed' | 'data' | 'time';

interface UnitDef {
  category: Category;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
  label: string;
}

const UNITS: Record<string, UnitDef> = {
  // Length (base: meters)
  m:    { category: 'length', toBase: v => v, fromBase: v => v, label: 'Meters' },
  km:   { category: 'length', toBase: v => v * 1000, fromBase: v => v / 1000, label: 'Kilometers' },
  cm:   { category: 'length', toBase: v => v / 100, fromBase: v => v * 100, label: 'Centimeters' },
  mm:   { category: 'length', toBase: v => v / 1000, fromBase: v => v * 1000, label: 'Millimeters' },
  mi:   { category: 'length', toBase: v => v * 1609.344, fromBase: v => v / 1609.344, label: 'Miles' },
  yd:   { category: 'length', toBase: v => v * 0.9144, fromBase: v => v / 0.9144, label: 'Yards' },
  ft:   { category: 'length', toBase: v => v * 0.3048, fromBase: v => v / 0.3048, label: 'Feet' },
  in:   { category: 'length', toBase: v => v * 0.0254, fromBase: v => v / 0.0254, label: 'Inches' },

  // Weight (base: grams)
  g:    { category: 'weight', toBase: v => v, fromBase: v => v, label: 'Grams' },
  kg:   { category: 'weight', toBase: v => v * 1000, fromBase: v => v / 1000, label: 'Kilograms' },
  mg:   { category: 'weight', toBase: v => v / 1000, fromBase: v => v * 1000, label: 'Milligrams' },
  lb:   { category: 'weight', toBase: v => v * 453.592, fromBase: v => v / 453.592, label: 'Pounds' },
  oz:   { category: 'weight', toBase: v => v * 28.3495, fromBase: v => v / 28.3495, label: 'Ounces' },
  ton:  { category: 'weight', toBase: v => v * 907185, fromBase: v => v / 907185, label: 'US Tons' },

  // Temperature (base: celsius)
  c:    { category: 'temperature', toBase: v => v, fromBase: v => v, label: 'Celsius' },
  f:    { category: 'temperature', toBase: v => (v - 32) * 5/9, fromBase: v => v * 9/5 + 32, label: 'Fahrenheit' },
  k:    { category: 'temperature', toBase: v => v - 273.15, fromBase: v => v + 273.15, label: 'Kelvin' },

  // Volume (base: liters)
  l:    { category: 'volume', toBase: v => v, fromBase: v => v, label: 'Liters' },
  ml:   { category: 'volume', toBase: v => v / 1000, fromBase: v => v * 1000, label: 'Milliliters' },
  gal:  { category: 'volume', toBase: v => v * 3.78541, fromBase: v => v / 3.78541, label: 'US Gallons' },
  qt:   { category: 'volume', toBase: v => v * 0.946353, fromBase: v => v / 0.946353, label: 'Quarts' },
  cup:  { category: 'volume', toBase: v => v * 0.236588, fromBase: v => v / 0.236588, label: 'Cups' },
  floz: { category: 'volume', toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735, label: 'Fluid Ounces' },

  // Speed (base: m/s)
  'ms':   { category: 'speed', toBase: v => v, fromBase: v => v, label: 'm/s' },
  'kmh':  { category: 'speed', toBase: v => v / 3.6, fromBase: v => v * 3.6, label: 'km/h' },
  'mph':  { category: 'speed', toBase: v => v * 0.44704, fromBase: v => v / 0.44704, label: 'mph' },
  'kn':   { category: 'speed', toBase: v => v * 0.514444, fromBase: v => v / 0.514444, label: 'Knots' },

  // Data (base: bytes)
  b:    { category: 'data', toBase: v => v, fromBase: v => v, label: 'Bytes' },
  kb:   { category: 'data', toBase: v => v * 1024, fromBase: v => v / 1024, label: 'KB' },
  mb:   { category: 'data', toBase: v => v * 1048576, fromBase: v => v / 1048576, label: 'MB' },
  gb:   { category: 'data', toBase: v => v * 1073741824, fromBase: v => v / 1073741824, label: 'GB' },
  tb:   { category: 'data', toBase: v => v * 1099511627776, fromBase: v => v / 1099511627776, label: 'TB' },

  // Time (base: seconds)
  s:    { category: 'time', toBase: v => v, fromBase: v => v, label: 'Seconds' },
  min:  { category: 'time', toBase: v => v * 60, fromBase: v => v / 60, label: 'Minutes' },
  hr:   { category: 'time', toBase: v => v * 3600, fromBase: v => v / 3600, label: 'Hours' },
  day:  { category: 'time', toBase: v => v * 86400, fromBase: v => v / 86400, label: 'Days' },
  wk:   { category: 'time', toBase: v => v * 604800, fromBase: v => v / 604800, label: 'Weeks' },
};

export function convert(value: number, from: string, to: string): { result: number; formatted: string } | { error: string } {
  const fromUnit = UNITS[from.toLowerCase()];
  const toUnit = UNITS[to.toLowerCase()];
  if (!fromUnit) return { error: `Unknown unit: ${from}` };
  if (!toUnit) return { error: `Unknown unit: ${to}` };
  if (fromUnit.category !== toUnit.category) return { error: `Cannot convert ${fromUnit.category} to ${toUnit.category}` };

  const base = fromUnit.toBase(value);
  const result = toUnit.fromBase(base);
  const formatted = `${value} ${fromUnit.label} = ${Number(result.toPrecision(8))} ${toUnit.label}`;
  return { result, formatted };
}

export function getCategories(): { category: Category; units: { code: string; label: string }[] }[] {
  const cats = new Map<Category, { code: string; label: string }[]>();
  for (const [code, def] of Object.entries(UNITS)) {
    if (!cats.has(def.category)) cats.set(def.category, []);
    cats.get(def.category)!.push({ code, label: def.label });
  }
  return [...cats.entries()].map(([category, units]) => ({ category, units }));
}
