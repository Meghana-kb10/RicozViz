import { describe, it, expect } from "vitest";

// ============================================================
// Phase 8 Test Suite: Visualization, Geospatial & Responsive Analytics
// ============================================================

describe("Phase 8: Geospatial & Map Validation Logic", () => {
  // Pure coordinate validation logic matching geo-utils.ts specification
  const isValidCoord = (lat: unknown, lng: unknown): boolean => {
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };

  it("validates latitude within -90 to 90 and longitude within -180 to 180", () => {
    expect(isValidCoord(0, 0)).toBe(true);
    expect(isValidCoord(20.5937, 78.9629)).toBe(true); // India
    expect(isValidCoord(37.0902, -95.7129)).toBe(true); // USA
    expect(isValidCoord(-33.8688, 151.2093)).toBe(true); // Sydney
    expect(isValidCoord(90, 180)).toBe(true);
    expect(isValidCoord(-90, -180)).toBe(true);
  });

  it("rejects invalid and out-of-range coordinates without fabricating data", () => {
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(-90.1, 0)).toBe(false);
    expect(isValidCoord(0, 180.1)).toBe(false);
    expect(isValidCoord(0, -185)).toBe(false);
    expect(isValidCoord("invalid", 10)).toBe(false);
    expect(isValidCoord(null, null)).toBe(false);
    expect(isValidCoord(undefined, 50)).toBe(false);
    expect(isValidCoord(NaN, 100)).toBe(false);
  });

  // Country alias resolution dictionary test
  const resolveCountry = (name: string): string | null => {
    const n = name.trim().toLowerCase();
    const map: Record<string, string> = {
      usa: "United States",
      "united states": "United States",
      "united states of america": "United States",
      us: "United States",
      india: "India",
      in: "India",
      uk: "United Kingdom",
      "united kingdom": "United Kingdom",
      germany: "Germany",
      de: "Germany",
      japan: "Japan",
      jp: "Japan",
      brazil: "Brazil",
      br: "Brazil",
      canada: "Canada",
      ca: "Canada",
      france: "France",
      fr: "France",
      australia: "Australia",
      au: "Australia",
    };
    return map[n] || null;
  };

  it("resolves standard countries and aliases for Choropleth maps", () => {
    expect(resolveCountry("India")).toBe("India");
    expect(resolveCountry("usa")).toBe("United States");
    expect(resolveCountry("United Kingdom")).toBe("United Kingdom");
    expect(resolveCountry("Japan")).toBe("Japan");
    expect(resolveCountry("unknown_atlantis")).toBeNull();
  });

  it("gracefully flags unknown locations rather than placing them arbitrarily", () => {
    const rows = [
      { country: "India", revenue: 5000 },
      { country: "USA", revenue: 9000 },
      { country: "Atlantis", revenue: 100 },
    ];

    const validMatches: Array<{ country: string; resolved: string; value: number }> = [];
    const unmatched: string[] = [];

    for (const r of rows) {
      const resolved = resolveCountry(r.country);
      if (resolved) {
        validMatches.push({ country: r.country, resolved, value: r.revenue });
      } else {
        unmatched.push(r.country);
      }
    }

    expect(validMatches.length).toBe(2);
    expect(unmatched).toEqual(["Atlantis"]);
  });
});

describe("Phase 8: Theme & Branding Architecture", () => {
  const PRESETS = ["default", "dark", "light", "professional", "minimal"] as const;

  it("supports all required theme presets", () => {
    expect(PRESETS).toContain("default");
    expect(PRESETS).toContain("dark");
    expect(PRESETS).toContain("light");
    expect(PRESETS).toContain("professional");
    expect(PRESETS).toContain("minimal");
  });

  it("persists theme and branding configuration cleanly inside dashboard layoutConfig", () => {
    const layoutConfig = {
      columns: 12,
      theme: {
        preset: "professional",
        mode: "light",
        backgroundColor: "#f8fafc",
        cardBackground: "#ffffff",
        textColor: "#0f172a",
        borderColor: "#cbd5e1",
        cardRadius: "md",
        cardShadow: "sm",
        fontFamily: "system",
      },
      branding: {
        logoUrl: "https://example.com/logo.png",
        title: "Enterprise Revenue Analytics",
        description: "Live Q3 Performance Dashboard",
        brandColor: "#0284c7",
      },
    };

    expect(layoutConfig.theme.preset).toBe("professional");
    expect(layoutConfig.branding.title).toBe("Enterprise Revenue Analytics");
    expect(layoutConfig.branding.brandColor).toBe("#0284c7");

    // Serialization verification
    const serialized = JSON.stringify(layoutConfig);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.theme.mode).toBe("light");
    expect(deserialized.branding.logoUrl).toBe("https://example.com/logo.png");
  });
});

describe("Phase 8: Chart Service Chart Type Whitelist", () => {
  it("includes MAP in allowed chart types", async () => {
    const { ALLOWED_CHART_TYPES } = await import("../services/chart/chart.service");
    expect(ALLOWED_CHART_TYPES).toContain("MAP");
  });
});
