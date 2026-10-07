// ============================================================
// Dashboard Themes, Presets & Branding Engine
// Phase 8: Advanced Themes & Enterprise Branding
// ============================================================

import type { DashboardThemeConfig, DashboardBrandingConfig, ThemePreset } from "./api";

export const THEME_PRESETS: Record<
  ThemePreset,
  {
    name: string;
    description: string;
    config: DashboardThemeConfig;
  }
> = {
  default: {
    name: "Default",
    description: "Modern Indigo interface with balanced neutral tones and crisp borders.",
    config: {
      preset: "default",
      mode: "light",
      backgroundColor: "#f8fafc",
      cardBackground: "#ffffff",
      textColor: "#0f172a",
      textMutedColor: "#64748b",
      borderColor: "#e2e8f0",
      cardRadius: "lg",
      cardShadow: "xs",
      fontFamily: "inter",
      chartPalette: ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"],
    },
  },
  dark: {
    name: "Dark",
    description: "Sleek deep-slate high contrast theme engineered for low-light environments.",
    config: {
      preset: "dark",
      mode: "dark",
      backgroundColor: "#090d16",
      cardBackground: "#111827",
      textColor: "#f8fafc",
      textMutedColor: "#94a3b8",
      borderColor: "#1f2937",
      cardRadius: "lg",
      cardShadow: "sm",
      fontFamily: "inter",
      chartPalette: ["#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"],
    },
  },
  light: {
    name: "Light",
    description: "Ultra-clean pure white canvas with subtle elevations and ocean accents.",
    config: {
      preset: "light",
      mode: "light",
      backgroundColor: "#ffffff",
      cardBackground: "#f9fafb",
      textColor: "#111827",
      textMutedColor: "#6b7280",
      borderColor: "#e5e7eb",
      cardRadius: "md",
      cardShadow: "none",
      fontFamily: "inter",
      chartPalette: ["#2563eb", "#0284c7", "#059669", "#d97706", "#dc2626", "#7c3aed"],
    },
  },
  professional: {
    name: "Professional",
    description: "Executive navy & silver styling designed for formal board presentations.",
    config: {
      preset: "professional",
      mode: "light",
      backgroundColor: "#f1f5f9",
      cardBackground: "#ffffff",
      textColor: "#0f172a",
      textMutedColor: "#475569",
      borderColor: "#cbd5e1",
      cardRadius: "sm",
      cardShadow: "sm",
      fontFamily: "serif",
      chartPalette: ["#1e3a8a", "#0f766e", "#b45309", "#4338ca", "#0369a1", "#334155"],
    },
  },
  minimal: {
    name: "Minimal",
    description: "Monochrome architectural design emphasizing typography and high data-ink ratio.",
    config: {
      preset: "minimal",
      mode: "light",
      backgroundColor: "#fafafa",
      cardBackground: "#ffffff",
      textColor: "#18181b",
      textMutedColor: "#71717a",
      borderColor: "#e4e4e7",
      cardRadius: "none",
      cardShadow: "none",
      fontFamily: "sans",
      chartPalette: ["#18181b", "#52525b", "#71717a", "#a1a1aa", "#27272a", "#3f3f46"],
    },
  },
  custom: {
    name: "Custom",
    description: "Handcrafted theme tailored to your bespoke branding and corporate identity.",
    config: {
      preset: "custom",
      mode: "light",
      backgroundColor: "#f8fafc",
      cardBackground: "#ffffff",
      textColor: "#0f172a",
      textMutedColor: "#64748b",
      borderColor: "#e2e8f0",
      cardRadius: "lg",
      cardShadow: "xs",
      fontFamily: "inter",
      chartPalette: ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"],
    },
  },
};

/**
 * Extracts and merges theme settings from layoutConfig.
 */
export function getDashboardTheme(layoutConfig: unknown): DashboardThemeConfig {
  if (!layoutConfig || typeof layoutConfig !== "object") {
    return THEME_PRESETS.default.config;
  }
  const meta = layoutConfig as Record<string, unknown>;
  const rawTheme = meta.theme;

  if (typeof rawTheme === "string" && rawTheme in THEME_PRESETS) {
    return THEME_PRESETS[rawTheme as ThemePreset].config;
  }

  if (rawTheme && typeof rawTheme === "object") {
    const custom = rawTheme as Partial<DashboardThemeConfig>;
    const base = custom.preset && custom.preset in THEME_PRESETS
      ? THEME_PRESETS[custom.preset].config
      : THEME_PRESETS.default.config;

    return {
      preset: custom.preset || base.preset,
      mode: custom.mode || base.mode,
      backgroundColor: custom.backgroundColor || base.backgroundColor,
      cardBackground: custom.cardBackground || base.cardBackground,
      textColor: custom.textColor || base.textColor,
      textMutedColor: custom.textMutedColor || base.textMutedColor,
      borderColor: custom.borderColor || base.borderColor,
      cardRadius: custom.cardRadius || base.cardRadius,
      cardShadow: custom.cardShadow || base.cardShadow,
      fontFamily: custom.fontFamily || base.fontFamily,
      chartPalette: Array.isArray(custom.chartPalette) && custom.chartPalette.length > 0
        ? custom.chartPalette
        : base.chartPalette,
    };
  }

  return THEME_PRESETS.default.config;
}

/**
 * Extracts branding settings from layoutConfig.
 */
export function getDashboardBranding(layoutConfig: unknown): DashboardBrandingConfig {
  if (!layoutConfig || typeof layoutConfig !== "object") {
    return {};
  }
  const meta = layoutConfig as Record<string, unknown>;
  const rawBranding = meta.branding;

  if (rawBranding && typeof rawBranding === "object") {
    return rawBranding as DashboardBrandingConfig;
  }

  return {};
}

/**
 * Resolves CSS inline styles for card radius
 */
export function getRadiusStyle(radius: DashboardThemeConfig["cardRadius"]): string {
  switch (radius) {
    case "none":
      return "0px";
    case "sm":
      return "6px";
    case "md":
      return "10px";
    case "lg":
      return "16px";
    case "xl":
      return "24px";
    default:
      return "12px";
  }
}

/**
 * Resolves CSS box shadow for card
 */
export function getShadowStyle(shadow: DashboardThemeConfig["cardShadow"], isDark = false): string {
  if (isDark) {
    switch (shadow) {
      case "none":
        return "none";
      case "xs":
        return "0 1px 2px 0 rgba(0, 0, 0, 0.4)";
      case "sm":
        return "0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)";
      case "md":
        return "0 4px 6px -1px rgba(0, 0, 0, 0.6), 0 2px 4px -2px rgba(0, 0, 0, 0.6)";
      case "lg":
        return "0 10px 15px -3px rgba(0, 0, 0, 0.7), 0 4px 6px -4px rgba(0, 0, 0, 0.7)";
      default:
        return "none";
    }
  }

  switch (shadow) {
    case "none":
      return "none";
    case "xs":
      return "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
    case "sm":
      return "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)";
    case "md":
      return "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)";
    case "lg":
      return "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)";
    default:
      return "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
  }
}

/**
 * Resolves font family CSS style
 */
export function getFontFamilyClass(font: DashboardThemeConfig["fontFamily"]): string {
  switch (font) {
    case "serif":
      return "font-serif";
    case "mono":
      return "font-mono";
    case "sans":
      return "font-sans";
    case "inter":
    default:
      return "font-sans";
  }
}
