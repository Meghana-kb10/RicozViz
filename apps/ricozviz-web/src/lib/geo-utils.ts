// ============================================================
// Geospatial Utilities, Coordinate Validation & SVG Projection
// Phase 8: Geospatial Analytics Engine
// ============================================================

export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  value: number;
  formattedValue: string;
  category?: string;
  regionCode?: string;
  rawRow: Record<string, unknown>;
}

export interface GeoRegion {
  code: string;
  name: string;
  value: number;
  formattedValue: string;
  centroid: [number, number]; // [lat, lng]
  svgPath?: string;
  rawRow?: Record<string, unknown>;
}

export interface GeoValidationResult {
  validPoints: GeoPoint[];
  validRegions: GeoRegion[];
  invalidCount: number;
  missingCoordCount: number;
  warnings: string[];
  error: string | null;
  geoColumnName: string;
  metricColumnName: string;
  minMetric: number;
  maxMetric: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

// ============================================================
// 1. COORDINATE VALIDATION
// ============================================================

export function isValidLatitude(lat: unknown): boolean {
  if (lat === null || lat === undefined || lat === "") return false;
  const num = typeof lat === "number" ? lat : Number(lat);
  return !isNaN(num) && isFinite(num) && num >= -90 && num <= 90;
}

export function isValidLongitude(lng: unknown): boolean {
  if (lng === null || lng === undefined || lng === "") return false;
  const num = typeof lng === "number" ? lng : Number(lng);
  return !isNaN(num) && isFinite(num) && num >= -180 && num <= 180;
}

export function validateCoordinates(
  lat: unknown,
  lng: unknown
): { valid: boolean; latNum?: number; lngNum?: number; reason?: string } {
  if (lat === null || lat === undefined || lat === "") {
    return { valid: false, reason: "Missing latitude coordinate" };
  }
  if (lng === null || lng === undefined || lng === "") {
    return { valid: false, reason: "Missing longitude coordinate" };
  }

  const latNum = typeof lat === "number" ? lat : Number(lat);
  const lngNum = typeof lng === "number" ? lng : Number(lng);

  if (isNaN(latNum) || !isFinite(latNum)) {
    return { valid: false, reason: `Latitude '${String(lat)}' is not a valid number` };
  }
  if (isNaN(lngNum) || !isFinite(lngNum)) {
    return { valid: false, reason: `Longitude '${String(lng)}' is not a valid number` };
  }
  if (latNum < -90 || latNum > 90) {
    return { valid: false, reason: `Latitude ${latNum} is out of bounds (allowed: -90 to 90)` };
  }
  if (lngNum < -180 || lngNum > 180) {
    return { valid: false, reason: `Longitude ${lngNum} is out of bounds (allowed: -180 to 180)` };
  }

  return { valid: true, latNum, lngNum };
}

// ============================================================
// 2. WORLD & REGIONAL ENTITIES (Centroids & Normalized Aliases)
// ============================================================

export interface KnownRegionDef {
  code: string;
  name: string;
  centroid: [number, number]; // [lat, lng]
  aliases: string[];
}

export const KNOWN_COUNTRIES: KnownRegionDef[] = [
  { code: "US", name: "United States", centroid: [37.09, -95.71], aliases: ["usa", "united states", "us", "u.s.", "united states of america", "america"] },
  { code: "IN", name: "India", centroid: [20.59, 78.96], aliases: ["india", "in", "ind", "bharat"] },
  { code: "GB", name: "United Kingdom", centroid: [55.37, -3.43], aliases: ["united kingdom", "uk", "u.k.", "gb", "gbr", "great britain", "britain", "england", "scotland", "wales"] },
  { code: "SE", name: "Sweden", centroid: [60.12, 18.64], aliases: ["sweden", "se", "swe"] },
  { code: "FI", name: "Finland", centroid: [61.92, 25.74], aliases: ["finland", "fi", "fin"] },
  { code: "DE", name: "Germany", centroid: [51.16, 10.45], aliases: ["germany", "de", "deu", "deutschland"] },
  { code: "FR", name: "France", centroid: [46.22, 2.21], aliases: ["france", "fr", "fra"] },
  { code: "CA", name: "Canada", centroid: [56.13, -106.34], aliases: ["canada", "ca", "can"] },
  { code: "AU", name: "Australia", centroid: [-25.27, 133.77], aliases: ["australia", "au", "aus"] },
  { code: "JP", name: "Japan", centroid: [36.20, 138.25], aliases: ["japan", "jp", "jpn"] },
  { code: "BR", name: "Brazil", centroid: [-14.23, -51.92], aliases: ["brazil", "br", "bra", "brasil"] },
  { code: "CN", name: "China", centroid: [35.86, 104.19], aliases: ["china", "cn", "chn"] },
  { code: "IT", name: "Italy", centroid: [41.87, 12.56], aliases: ["italy", "it", "ita", "italia"] },
  { code: "ES", name: "Spain", centroid: [40.46, -3.74], aliases: ["spain", "es", "esp", "españa"] },
  { code: "NL", name: "Netherlands", centroid: [52.13, 5.29], aliases: ["netherlands", "nl", "nld", "holland"] },
  { code: "CH", name: "Switzerland", centroid: [46.81, 8.22], aliases: ["switzerland", "ch", "che"] },
  { code: "NO", name: "Norway", centroid: [60.47, 8.46], aliases: ["norway", "no", "nor"] },
  { code: "DK", name: "Denmark", centroid: [56.26, 9.50], aliases: ["denmark", "dk", "dnk"] },
  { code: "PL", name: "Poland", centroid: [51.91, 19.14], aliases: ["poland", "pl", "pol"] },
  { code: "RU", name: "Russia", centroid: [61.52, 105.31], aliases: ["russia", "ru", "rus", "russian federation"] },
  { code: "MX", name: "Mexico", centroid: [23.63, -102.55], aliases: ["mexico", "mx", "mex"] },
  { code: "ZA", name: "South Africa", centroid: [-30.55, 22.93], aliases: ["south africa", "za", "zaf"] },
  { code: "KR", name: "South Korea", centroid: [35.90, 127.76], aliases: ["south korea", "kr", "kor", "korea"] },
  { code: "SG", name: "Singapore", centroid: [1.35, 103.81], aliases: ["singapore", "sg", "sgp"] },
  { code: "AE", name: "United Arab Emirates", centroid: [23.42, 53.84], aliases: ["united arab emirates", "uae", "ae", "are", "dubai"] },
  { code: "SA", name: "Saudi Arabia", centroid: [23.88, 45.07], aliases: ["saudi arabia", "sa", "sau"] },
  { code: "AR", name: "Argentina", centroid: [-38.41, -63.61], aliases: ["argentina", "ar", "arg"] },
  { code: "CL", name: "Chile", centroid: [-35.67, -71.54], aliases: ["chile", "cl", "chl"] },
  { code: "EG", name: "Egypt", centroid: [26.82, 30.80], aliases: ["egypt", "eg", "egy"] },
  { code: "NG", name: "Nigeria", centroid: [9.08, 8.67], aliases: ["nigeria", "ng", "nga"] },
  { code: "ID", name: "Indonesia", centroid: [-0.78, 113.92], aliases: ["indonesia", "id", "idn"] },
  { code: "NZ", name: "New Zealand", centroid: [-40.90, 174.88], aliases: ["new zealand", "nz", "nzl"] },
  { code: "IE", name: "Ireland", centroid: [53.14, -7.69], aliases: ["ireland", "ie", "irl"] },
  { code: "BE", name: "Belgium", centroid: [50.50, 4.46], aliases: ["belgium", "be", "bel"] },
  { code: "AT", name: "Austria", centroid: [47.51, 14.55], aliases: ["austria", "at", "aut"] },
];

export const KNOWN_US_STATES: KnownRegionDef[] = [
  { code: "US-AL", name: "Alabama", centroid: [32.31, -86.90], aliases: ["al", "alabama"] },
  { code: "US-AK", name: "Alaska", centroid: [64.20, -149.49], aliases: ["ak", "alaska"] },
  { code: "US-AZ", name: "Arizona", centroid: [34.04, -111.09], aliases: ["az", "arizona"] },
  { code: "US-AR", name: "Arkansas", centroid: [35.20, -91.83], aliases: ["ar", "arkansas"] },
  { code: "US-CA", name: "California", centroid: [36.77, -119.41], aliases: ["ca", "california"] },
  { code: "US-CO", name: "Colorado", centroid: [39.55, -105.78], aliases: ["co", "colorado"] },
  { code: "US-CT", name: "Connecticut", centroid: [41.60, -73.08], aliases: ["ct", "connecticut"] },
  { code: "US-DE", name: "Delaware", centroid: [38.91, -75.52], aliases: ["de", "delaware"] },
  { code: "US-FL", name: "Florida", centroid: [27.66, -81.51], aliases: ["fl", "florida"] },
  { code: "US-GA", name: "Georgia", centroid: [32.16, -82.90], aliases: ["ga", "georgia"] },
  { code: "US-HI", name: "Hawaii", centroid: [19.89, -155.58], aliases: ["hi", "hawaii"] },
  { code: "US-ID", name: "Idaho", centroid: [44.06, -114.74], aliases: ["id", "idaho"] },
  { code: "US-IL", name: "Illinois", centroid: [40.63, -89.39], aliases: ["il", "illinois"] },
  { code: "US-IN", name: "Indiana", centroid: [40.55, -85.60], aliases: ["in", "indiana"] },
  { code: "US-IA", name: "Iowa", centroid: [41.87, -93.09], aliases: ["ia", "iowa"] },
  { code: "US-KS", name: "Kansas", centroid: [39.01, -98.48], aliases: ["ks", "kansas"] },
  { code: "US-KY", name: "Kentucky", centroid: [37.83, -84.27], aliases: ["ky", "kentucky"] },
  { code: "US-LA", name: "Louisiana", centroid: [31.24, -92.14], aliases: ["la", "louisiana"] },
  { code: "US-MA", name: "Massachusetts", centroid: [42.40, -71.38], aliases: ["ma", "massachusetts"] },
  { code: "US-MD", name: "Maryland", centroid: [39.04, -76.64], aliases: ["md", "maryland"] },
  { code: "US-MI", name: "Michigan", centroid: [44.31, -85.60], aliases: ["mi", "michigan"] },
  { code: "US-MN", name: "Minnesota", centroid: [46.72, -94.68], aliases: ["mn", "minnesota"] },
  { code: "US-MO", name: "Missouri", centroid: [37.96, -91.83], aliases: ["mo", "missouri"] },
  { code: "US-MS", name: "Mississippi", centroid: [32.35, -89.39], aliases: ["ms", "mississippi"] },
  { code: "US-MT", name: "Montana", centroid: [46.87, -110.36], aliases: ["mt", "montana"] },
  { code: "US-NC", name: "North Carolina", centroid: [35.75, -79.01], aliases: ["nc", "north carolina"] },
  { code: "US-ND", name: "North Dakota", centroid: [47.55, -101.00], aliases: ["nd", "north dakota"] },
  { code: "US-NE", name: "Nebraska", centroid: [41.49, -99.90], aliases: ["ne", "nebraska"] },
  { code: "US-NH", name: "New Hampshire", centroid: [43.19, -71.57], aliases: ["nh", "new hampshire"] },
  { code: "US-NJ", name: "New Jersey", centroid: [40.05, -74.40], aliases: ["nj", "new jersey"] },
  { code: "US-NM", name: "New Mexico", centroid: [34.51, -105.87], aliases: ["nm", "new mexico"] },
  { code: "US-NV", name: "Nevada", centroid: [38.80, -116.41], aliases: ["nv", "nevada"] },
  { code: "US-NY", name: "New York", centroid: [40.71, -74.00], aliases: ["ny", "new york"] },
  { code: "US-OH", name: "Ohio", centroid: [40.41, -82.90], aliases: ["oh", "ohio"] },
  { code: "US-OK", name: "Oklahoma", centroid: [35.00, -97.09], aliases: ["ok", "oklahoma"] },
  { code: "US-OR", name: "Oregon", centroid: [43.80, -120.55], aliases: ["or", "oregon"] },
  { code: "US-PA", name: "Pennsylvania", centroid: [41.20, -77.19], aliases: ["pa", "pennsylvania"] },
  { code: "US-RI", name: "Rhode Island", centroid: [41.58, -71.47], aliases: ["ri", "rhode island"] },
  { code: "US-SC", name: "South Carolina", centroid: [33.83, -81.16], aliases: ["sc", "south carolina"] },
  { code: "US-SD", name: "South Dakota", centroid: [43.96, -99.90], aliases: ["sd", "south dakota"] },
  { code: "US-TN", name: "Tennessee", centroid: [35.51, -86.58], aliases: ["tn", "tennessee"] },
  { code: "US-TX", name: "Texas", centroid: [31.96, -99.90], aliases: ["tx", "texas"] },
  { code: "US-UT", name: "Utah", centroid: [39.32, -111.09], aliases: ["ut", "utah"] },
  { code: "US-VA", name: "Virginia", centroid: [37.43, -78.65], aliases: ["va", "virginia"] },
  { code: "US-VT", name: "Vermont", centroid: [44.55, -72.57], aliases: ["vt", "vermont"] },
  { code: "US-WA", name: "Washington", centroid: [47.75, -120.74], aliases: ["wa", "washington"] },
  { code: "US-WI", name: "Wisconsin", centroid: [43.78, -88.78], aliases: ["wi", "wisconsin"] },
  { code: "US-WV", name: "West Virginia", centroid: [38.59, -80.45], aliases: ["wv", "west virginia"] },
  { code: "US-WY", name: "Wyoming", centroid: [43.07, -107.29], aliases: ["wy", "wyoming"] },
];

/**
 * Normalizes and resolves a text location (country or state) to a known geographic entity.
 */
export function resolveLocationEntity(rawText: string): KnownRegionDef | null {
  if (!rawText || typeof rawText !== "string") return null;
  const clean = rawText.trim().toLowerCase();

  // 1. Try countries
  for (const c of KNOWN_COUNTRIES) {
    if (c.code.toLowerCase() === clean || c.name.toLowerCase() === clean || c.aliases.includes(clean)) {
      return c;
    }
  }

  // 2. Try US States
  for (const s of KNOWN_US_STATES) {
    if (s.code.toLowerCase() === clean || s.name.toLowerCase() === clean || s.aliases.includes(clean)) {
      return s;
    }
  }

  return null;
}

// ============================================================
// 3. SVG PROJECTION MATH (Equirectangular)
// ============================================================

export const SVG_MAP_WIDTH = 960;
export const SVG_MAP_HEIGHT = 500;

/**
 * Projects a [lat, lng] to SVG canvas coordinates (0..960, 0..500)
 */
export function projectCoordinates(
  lat: number,
  lng: number,
  width = SVG_MAP_WIDTH,
  height = SVG_MAP_HEIGHT
): { x: number; y: number } {
  // Clamped equirectangular projection
  const clampedLng = Math.max(-180, Math.min(180, lng));
  const clampedLat = Math.max(-85, Math.min(85, lat));

  const x = ((clampedLng + 180) / 360) * width;
  // Invert Y axis: 90 is top (y=0), -90 is bottom (y=height)
  const y = ((90 - clampedLat) / 180) * height;

  return { x, y };
}

// ============================================================
// 4. EMBEDDED WORLD GEOGRAPHIC VECTOR PATHS
// ============================================================
// Scaled to 960x500 standard SVG canvas for lightweight, zero-dependency rendering

export interface WorldPathDef {
  code: string;
  name: string;
  d: string;
}

export const WORLD_BASE_PATHS: WorldPathDef[] = [
  // North America
  {
    code: "US",
    name: "United States",
    d: "M 150 180 L 170 175 L 220 170 L 260 175 L 290 190 L 285 240 L 250 250 L 210 260 L 160 240 L 140 210 Z",
  },
  {
    code: "CA",
    name: "Canada",
    d: "M 120 120 L 190 90 L 260 80 L 310 110 L 290 170 L 220 160 L 150 170 L 110 150 Z",
  },
  {
    code: "MX",
    name: "Mexico",
    d: "M 160 245 L 210 265 L 230 280 L 220 310 L 190 300 L 170 270 Z",
  },
  // South America
  {
    code: "BR",
    name: "Brazil",
    d: "M 270 320 L 330 320 L 365 350 L 340 410 L 290 400 L 270 350 Z",
  },
  {
    code: "AR",
    name: "Argentina",
    d: "M 285 410 L 315 410 L 310 470 L 290 480 L 280 430 Z",
  },
  {
    code: "CL",
    name: "Chile",
    d: "M 275 390 L 285 390 L 280 480 L 270 470 Z",
  },
  // Europe
  {
    code: "GB",
    name: "United Kingdom",
    d: "M 460 145 L 475 140 L 472 170 L 458 175 L 455 155 Z",
  },
  {
    code: "FR",
    name: "France",
    d: "M 468 180 L 490 178 L 495 205 L 470 210 L 465 190 Z",
  },
  {
    code: "DE",
    name: "Germany",
    d: "M 495 165 L 515 162 L 520 190 L 492 192 Z",
  },
  {
    code: "SE",
    name: "Sweden",
    d: "M 505 105 L 525 100 L 530 155 L 510 160 Z",
  },
  {
    code: "FI",
    name: "Finland",
    d: "M 532 95 L 550 95 L 552 145 L 530 148 Z",
  },
  {
    code: "IT",
    name: "Italy",
    d: "M 498 208 L 512 205 L 525 240 L 515 250 L 505 225 Z",
  },
  {
    code: "ES",
    name: "Spain",
    d: "M 445 205 L 470 205 L 468 235 L 440 235 Z",
  },
  {
    code: "RU",
    name: "Russia",
    d: "M 555 85 L 680 70 L 800 80 L 880 110 L 850 170 L 710 160 L 570 150 L 550 110 Z",
  },
  // Asia
  {
    code: "IN",
    name: "India",
    d: "M 660 230 L 700 235 L 710 280 L 685 315 L 665 270 Z",
  },
  {
    code: "CN",
    name: "China",
    d: "M 690 170 L 780 165 L 810 210 L 760 250 L 705 240 L 680 200 Z",
  },
  {
    code: "JP",
    name: "Japan",
    d: "M 830 180 L 845 175 L 850 210 L 835 220 Z",
  },
  {
    code: "KR",
    name: "South Korea",
    d: "M 795 200 L 805 198 L 808 215 L 798 218 Z",
  },
  {
    code: "ID",
    name: "Indonesia",
    d: "M 740 310 L 810 315 L 820 330 L 750 330 Z",
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    d: "M 585 235 L 630 240 L 635 280 L 595 285 Z",
  },
  // Africa
  {
    code: "EG",
    name: "Egypt",
    d: "M 535 225 L 565 225 L 565 260 L 535 260 Z",
  },
  {
    code: "NG",
    name: "Nigeria",
    d: "M 480 280 L 515 280 L 515 310 L 480 310 Z",
  },
  {
    code: "ZA",
    name: "South Africa",
    d: "M 515 390 L 560 390 L 555 440 L 510 435 Z",
  },
  // Oceania
  {
    code: "AU",
    name: "Australia",
    d: "M 780 360 L 870 355 L 880 420 L 790 430 L 775 390 Z",
  },
  {
    code: "NZ",
    name: "New Zealand",
    d: "M 890 430 L 905 430 L 915 470 L 900 475 Z",
  },
];

// ============================================================
// 5. COLOR SCALE PALETTES FOR CHOROPLETH & BUBBLES
// ============================================================

export type ColorPaletteName = "indigo" | "emerald" | "amber" | "rose" | "blue" | "slate";

export const GEO_PALETTES: Record<ColorPaletteName, { ramp: string[]; accent: string; label: string }> = {
  indigo: {
    ramp: ["#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#3730a3"],
    accent: "#4f46e5",
    label: "Indigo Horizon",
  },
  emerald: {
    ramp: ["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#065f46"],
    accent: "#10b981",
    label: "Emerald Growth",
  },
  amber: {
    ramp: ["#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309"],
    accent: "#f59e0b",
    label: "Amber Sun",
  },
  rose: {
    ramp: ["#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#9f1239"],
    accent: "#e11d48",
    label: "Rose Crimson",
  },
  blue: {
    ramp: ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1e40af"],
    accent: "#2563eb",
    label: "Ocean Blue",
  },
  slate: {
    ramp: ["#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#1e293b"],
    accent: "#475569",
    label: "Monochrome Slate",
  },
};

/**
 * Returns color from palette for a normalized value 0..1
 */
export function interpolateGeoColor(
  ratio: number,
  palette: ColorPaletteName = "indigo"
): string {
  const colors = GEO_PALETTES[palette]?.ramp || GEO_PALETTES.indigo.ramp;
  const clamped = Math.max(0, Math.min(1, ratio));
  const idx = Math.min(
    colors.length - 1,
    Math.floor(clamped * (colors.length - 1))
  );
  return colors[idx];
}

// ============================================================
// 6. PIPELINE VALIDATOR & PARSER FOR QUERY RESULT ROWS
// ============================================================

export function processAndValidateGeoData(
  rows: Record<string, unknown>[],
  columns: Array<{ name: string; type: string }>,
  config: Record<string, unknown>
): GeoValidationResult {
  const options = (config.options || {}) as Record<string, unknown>;
  const warnings: string[] = [];
  const validPoints: GeoPoint[] = [];
  const validRegions: GeoRegion[] = [];
  let invalidCount = 0;
  let missingCoordCount = 0;

  // 1. Identify Geographic & Metric Columns
  const dimensions = (config.dimensions as string[]) || [];
  const measures = (config.measures as Array<{ column: string; alias?: string }>) || [];

  // Determine Geo Field
  let geoCol =
    (options.geoColumn as string) ||
    dimensions[0] ||
    (config.xAxis as string) ||
    "";

  // Determine Coordinate Fields (if any)
  let latCol = (options.latColumn as string) || "";
  let lngCol = (options.lngColumn as string) || "";

  // Auto-detect lat/lng columns if not explicitly specified
  if (!latCol || !lngCol) {
    const latCandidate = columns.find((c) => /^(lat|latitude|y_coord)$/i.test(c.name));
    const lngCandidate = columns.find((c) => /^(lng|lon|longitude|long|x_coord)$/i.test(c.name));
    if (latCandidate && lngCandidate) {
      latCol = latCandidate.name;
      lngCol = lngCandidate.name;
    }
  }

  // Auto-detect geographic string column if not found
  if (!geoCol && !latCol) {
    const geoCandidate = columns.find((c) =>
      /^(country|nation|state|province|city|region|location|territory)$/i.test(c.name)
    );
    if (geoCandidate) {
      geoCol = geoCandidate.name;
    } else if (columns.length > 0) {
      geoCol = columns[0].name;
    }
  }

  // Determine Metric Column
  let metricCol =
    measures[0]?.alias ||
    measures[0]?.column ||
    (config.yAxis as string) ||
    "";

  if (!metricCol) {
    // Find first numeric column that is not lat/lng
    const numCandidate = columns.find(
      (c) =>
        (c.type.toLowerCase().includes("number") || c.type.toLowerCase().includes("int")) &&
        c.name !== latCol &&
        c.name !== lngCol
    );
    metricCol = numCandidate?.name || (columns[1]?.name ?? "value");
  }

  if (rows.length === 0) {
    return {
      validPoints: [],
      validRegions: [],
      invalidCount: 0,
      missingCoordCount: 0,
      warnings: ["Dataset contains 0 rows."],
      error: null,
      geoColumnName: geoCol,
      metricColumnName: metricCol,
      minMetric: 0,
      maxMetric: 0,
      bounds: { minLat: -85, maxLat: 85, minLng: -180, maxLng: 180 },
    };
  }

  const isCoordinateMode = Boolean(latCol && lngCol);
  let minMetric = Infinity;
  let maxMetric = -Infinity;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  // Track aggregation by region code for choropleth/region mapping
  const regionAggMap = new Map<
    string,
    { entity: KnownRegionDef; totalVal: number; count: number; rawRows: Record<string, unknown>[] }
  >();

  // Iterate over records
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const metricRaw = row[metricCol];
    const numVal = metricRaw !== undefined && metricRaw !== null ? Number(metricRaw) : 1;
    const cleanMetric = isNaN(numVal) ? 1 : numVal;

    // Coordinate Mode: (lat, lng) present
    if (isCoordinateMode) {
      const latVal = row[latCol];
      const lngVal = row[lngCol];

      if (latVal === null || latVal === undefined || lngVal === null || lngVal === undefined) {
        missingCoordCount++;
        continue;
      }

      const check = validateCoordinates(latVal, lngVal);
      if (!check.valid || check.latNum === undefined || check.lngNum === undefined) {
        invalidCount++;
        if (warnings.length < 3) {
          warnings.push(`Row ${idx + 1}: ${check.reason}`);
        }
        continue;
      }

      const pointName = String(
        row[geoCol] || row.name || row.city || row.state || row.country || `Point #${idx + 1}`
      );

      minMetric = Math.min(minMetric, cleanMetric);
      maxMetric = Math.max(maxMetric, cleanMetric);

      minLat = Math.min(minLat, check.latNum);
      maxLat = Math.max(maxLat, check.latNum);
      minLng = Math.min(minLng, check.lngNum);
      maxLng = Math.max(maxLng, check.lngNum);

      validPoints.push({
        id: `point-${idx}`,
        lat: check.latNum,
        lng: check.lngNum,
        name: pointName,
        value: cleanMetric,
        formattedValue: cleanMetric.toLocaleString(),
        rawRow: row,
      });
    }

    // Region / Entity Mode: geographic name (Country / State)
    if (geoCol && row[geoCol] !== undefined) {
      const geoText = String(row[geoCol]).trim();
      const entity = resolveLocationEntity(geoText);

      if (entity) {
        minMetric = Math.min(minMetric, cleanMetric);
        maxMetric = Math.max(maxMetric, cleanMetric);

        const existing = regionAggMap.get(entity.code);
        if (existing) {
          existing.totalVal += cleanMetric;
          existing.count += 1;
          existing.rawRows.push(row);
        } else {
          regionAggMap.set(entity.code, {
            entity,
            totalVal: cleanMetric,
            count: 1,
            rawRows: [row],
          });
        }

        // If not in coordinate mode, also generate validPoints based on entity centroids
        if (!isCoordinateMode) {
          validPoints.push({
            id: `geo-${idx}`,
            lat: entity.centroid[0],
            lng: entity.centroid[1],
            name: entity.name,
            value: cleanMetric,
            formattedValue: cleanMetric.toLocaleString(),
            regionCode: entity.code,
            rawRow: row,
          });
        }
      } else if (!isCoordinateMode) {
        invalidCount++;
        if (warnings.length < 3 && geoText) {
          warnings.push(`Unrecognized geographic region: "${geoText}"`);
        }
      }
    }
  }

  // Construct validRegions array for Choropleth
  for (const [code, agg] of regionAggMap.entries()) {
    const basePath = WORLD_BASE_PATHS.find((p) => p.code === code);
    validRegions.push({
      code,
      name: agg.entity.name,
      value: agg.totalVal,
      formattedValue: agg.totalVal.toLocaleString(),
      centroid: agg.entity.centroid,
      svgPath: basePath?.d,
      rawRow: agg.rawRows[0],
    });
  }

  // Summary diagnostics
  if (minMetric === Infinity) minMetric = 0;
  if (maxMetric === -Infinity) maxMetric = 1;

  if (invalidCount > 0) {
    warnings.unshift(
      `${invalidCount} row${invalidCount === 1 ? "" : "s"} had invalid or unrecognized geographic data and ${invalidCount === 1 ? "was" : "were"} omitted.`
    );
  }
  if (missingCoordCount > 0) {
    warnings.push(`${missingCoordCount} row${missingCoordCount === 1 ? "" : "s"} lacked coordinates.`);
  }

  // Check if completely unmappable
  let error: string | null = null;
  if (validPoints.length === 0 && validRegions.length === 0) {
    if (isCoordinateMode) {
      error = `No valid coordinates found in columns '${latCol}' and '${lngCol}'. Latitude must be between -90 and 90, Longitude between -180 and 180.`;
    } else {
      error = `Could not resolve any rows from column '${geoCol}' to recognized countries, states, or regions.`;
    }
  }

  return {
    validPoints,
    validRegions,
    invalidCount,
    missingCoordCount,
    warnings,
    error,
    geoColumnName: geoCol,
    metricColumnName: metricCol,
    minMetric,
    maxMetric,
    bounds: {
      minLat: minLat <= maxLat ? minLat : -85,
      maxLat: minLat <= maxLat ? maxLat : 85,
      minLng: minLng <= maxLng ? minLng : -180,
      maxLng: minLng <= maxLng ? maxLng : 180,
    },
  };
}
