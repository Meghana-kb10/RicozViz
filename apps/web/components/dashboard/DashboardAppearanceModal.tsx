"use client";

import React, { useState } from "react";
import {
  X,
  Palette,
  Sparkles,
  Check,
  Eye,
  Type,
  Layout,
  Sliders,
  Image as ImageIcon,
  Sun,
  Moon,
  RefreshCw,
  Save,
} from "lucide-react";
import type { DashboardThemeConfig, DashboardBrandingConfig, ThemePreset } from "../../lib/api";
import {
  THEME_PRESETS,
  getRadiusStyle,
  getShadowStyle,
  getFontFamilyClass,
} from "../../lib/theme-utils";

export interface DashboardAppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTheme: DashboardThemeConfig;
  initialBranding: DashboardBrandingConfig;
  dashboardTitle: string;
  dashboardDescription?: string | null;
  onSave: (theme: DashboardThemeConfig, branding: DashboardBrandingConfig) => Promise<void>;
  isSaving?: boolean;
}

const PRESET_LIST: ThemePreset[] = ["default", "dark", "light", "professional", "minimal"];

const PALETTE_OPTIONS: { name: string; colors: string[] }[] = [
  { name: "Indigo Horizon", colors: ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"] },
  { name: "Emerald Growth", colors: ["#059669", "#10b981", "#34d399", "#6ee7b7", "#047857", "#065f46"] },
  { name: "Ocean Breeze", colors: ["#2563eb", "#0284c7", "#38bdf8", "#60a5fa", "#1d4ed8", "#0369a1"] },
  { name: "Sunset Amber", colors: ["#f59e0b", "#d97706", "#ef4444", "#f97316", "#b45309", "#dc2626"] },
  { name: "Corporate Slate", colors: ["#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"] },
];

export function DashboardAppearanceModal({
  isOpen,
  onClose,
  initialTheme,
  initialBranding,
  dashboardTitle,
  dashboardDescription,
  onSave,
  isSaving = false,
}: DashboardAppearanceModalProps) {
  const [activeTab, setActiveTab] = useState<"theme" | "branding">("theme");

  // Working Theme State
  const [theme, setTheme] = useState<DashboardThemeConfig>(initialTheme);

  // Working Branding State
  const [branding, setBranding] = useState<DashboardBrandingConfig>({
    logoUrl: initialBranding.logoUrl || "",
    title: initialBranding.title || dashboardTitle || "",
    description: initialBranding.description || dashboardDescription || "",
    brandColor: initialBranding.brandColor || "#4f46e5",
    faviconUrl: initialBranding.faviconUrl || "",
    typography: initialBranding.typography || "inter",
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset Selection
  const handleSelectPreset = (preset: ThemePreset) => {
    const presetConfig = THEME_PRESETS[preset]?.config || THEME_PRESETS.default.config;
    setTheme({
      ...presetConfig,
      preset,
    });
  };

  // Submit Handler
  const handleSave = async () => {
    setSaveError(null);
    try {
      await onSave(theme, branding);
      onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save theme and branding");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Dashboard Appearance & Branding
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Customize colors, card surfaces, corporate branding, and visual typography.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("theme")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition ${
              activeTab === "theme"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Theme & Styling</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("branding")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition ${
              activeTab === "branding"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Corporate Branding</span>
          </button>
        </div>

        {/* Modal Body: Two Columns (Controls on Left, Live Preview on Right) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Form Controls */}
          <div className="md:col-span-7 p-6 overflow-y-auto space-y-6 border-r border-gray-100 dark:border-slate-800">
            {saveError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {saveError}
              </div>
            )}

            {/* TAB 1: THEME & STYLING */}
            {activeTab === "theme" && (
              <div className="space-y-6">
                {/* 1. Presets */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-2">
                    Theme Presets
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_LIST.map((p) => {
                      const item = THEME_PRESETS[p];
                      const isSelected = theme.preset === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-600 shadow-xs"
                              : "border-gray-200 dark:border-slate-800 hover:border-gray-300 bg-white dark:bg-slate-900"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                {item.name}
                              </span>
                              {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                            </div>
                            <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                          {/* Mini swatch preview */}
                          <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                            <span
                              className="h-3 w-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: item.config.backgroundColor }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: item.config.cardBackground }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: item.config.chartPalette[0] }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Mode (Light / Dark) */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    {theme.mode === "dark" ? (
                      <Moon className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Sun className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Color Mode
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setTheme({ ...theme, mode: "light", preset: "custom" })}
                      className={`px-3 py-1 rounded-md transition ${
                        theme.mode === "light"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                      }`}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme({ ...theme, mode: "dark", preset: "custom" })}
                      className={`px-3 py-1 rounded-md transition ${
                        theme.mode === "dark"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                      }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>

                {/* 3. Surface & Canvas Colors */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                    Canvas & Surface Colors
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                        Canvas Background
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.backgroundColor}
                          onChange={(e) =>
                            setTheme({ ...theme, backgroundColor: e.target.value, preset: "custom" })
                          }
                          className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.backgroundColor}
                          onChange={(e) =>
                            setTheme({ ...theme, backgroundColor: e.target.value, preset: "custom" })
                          }
                          className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 px-2 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                        Card Background
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.cardBackground}
                          onChange={(e) =>
                            setTheme({ ...theme, cardBackground: e.target.value, preset: "custom" })
                          }
                          className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.cardBackground}
                          onChange={(e) =>
                            setTheme({ ...theme, cardBackground: e.target.value, preset: "custom" })
                          }
                          className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 px-2 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                        Text Color
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.textColor}
                          onChange={(e) =>
                            setTheme({ ...theme, textColor: e.target.value, preset: "custom" })
                          }
                          className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.textColor}
                          onChange={(e) =>
                            setTheme({ ...theme, textColor: e.target.value, preset: "custom" })
                          }
                          className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 px-2 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                        Border Color
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.borderColor}
                          onChange={(e) =>
                            setTheme({ ...theme, borderColor: e.target.value, preset: "custom" })
                          }
                          className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.borderColor}
                          onChange={(e) =>
                            setTheme({ ...theme, borderColor: e.target.value, preset: "custom" })
                          }
                          className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 px-2 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Card Geometry & Elevation */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Card Corner Radius
                    </label>
                    <select
                      value={theme.cardRadius}
                      onChange={(e) =>
                        setTheme({
                          ...theme,
                          cardRadius: e.target.value as DashboardThemeConfig["cardRadius"],
                          preset: "custom",
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 p-2 text-xs text-gray-800 dark:text-gray-200 focus:outline-none"
                    >
                      <option value="none">Square (0px)</option>
                      <option value="sm">Small (6px)</option>
                      <option value="md">Medium (10px)</option>
                      <option value="lg">Large (16px)</option>
                      <option value="xl">Extra Large (24px)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Card Elevation (Shadow)
                    </label>
                    <select
                      value={theme.cardShadow}
                      onChange={(e) =>
                        setTheme({
                          ...theme,
                          cardShadow: e.target.value as DashboardThemeConfig["cardShadow"],
                          preset: "custom",
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 p-2 text-xs text-gray-800 dark:text-gray-200 focus:outline-none"
                    >
                      <option value="none">Flat (None)</option>
                      <option value="xs">Subtle (XS)</option>
                      <option value="sm">Soft (SM)</option>
                      <option value="md">Standard (MD)</option>
                      <option value="lg">Elevated (LG)</option>
                    </select>
                  </div>
                </div>

                {/* 5. Chart Palette Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-2">
                    Chart Color Palette
                  </label>
                  <div className="space-y-2">
                    {PALETTE_OPTIONS.map((pal) => (
                      <button
                        key={pal.name}
                        type="button"
                        onClick={() =>
                          setTheme({ ...theme, chartPalette: pal.colors, preset: "custom" })
                        }
                        className={`w-full flex items-center justify-between p-2 rounded-lg border transition ${
                          JSON.stringify(theme.chartPalette) === JSON.stringify(pal.colors)
                            ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-600"
                            : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                          {pal.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {pal.colors.map((c, idx) => (
                            <span
                              key={idx}
                              className="h-4 w-4 rounded-full border border-white/50"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CORPORATE BRANDING */}
            {activeTab === "branding" && (
              <div className="space-y-4">
                {/* Logo URL */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">
                    Company Logo URL
                  </label>
                  <input
                    type="url"
                    value={branding.logoUrl || ""}
                    onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 p-2.5 text-xs text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Displays at the top header of both editor and shared dashboard links.
                  </span>
                </div>

                {/* Title & Description Override */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">
                    Dashboard Display Title
                  </label>
                  <input
                    type="text"
                    value={branding.title || ""}
                    onChange={(e) => setBranding({ ...branding, title: e.target.value })}
                    placeholder="Custom Dashboard Name"
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 p-2.5 text-xs text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">
                    Subtitle / Description
                  </label>
                  <textarea
                    rows={2}
                    value={branding.description || ""}
                    onChange={(e) => setBranding({ ...branding, description: e.target.value })}
                    placeholder="Custom dashboard subtitle, report notes, or department context"
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 p-2 text-xs text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Primary Brand Accent Color */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">
                    Brand Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={branding.brandColor || "#4f46e5"}
                      onChange={(e) => setBranding({ ...branding, brandColor: e.target.value })}
                      className="h-9 w-12 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.brandColor || "#4f46e5"}
                      onChange={(e) => setBranding({ ...branding, brandColor: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 p-2 text-xs font-mono text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>

                {/* Typography Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">
                    Typography Option
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "inter", name: "Inter (Modern Tech)" },
                      { id: "sans", name: "System Sans (Clean)" },
                      { id: "serif", name: "Serif (Corporate Editorial)" },
                      { id: "mono", name: "Monospace (Data Native)" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setBranding({
                            ...branding,
                            typography: t.id as DashboardBrandingConfig["typography"],
                          })
                        }
                        className={`p-2.5 rounded-lg border text-left text-xs font-medium transition ${
                          branding.typography === t.id
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-600"
                            : "border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Preview */}
          <div className="md:col-span-5 p-6 bg-gray-50/60 dark:bg-slate-950/60 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Live Preview
                </span>
                <span className="text-[10px] font-mono text-gray-400 capitalize">
                  Preset: {theme.preset}
                </span>
              </div>

              {/* Mini Preview Box */}
              <div
                className={`w-full rounded-xl p-4 transition-all duration-200 border ${getFontFamilyClass(branding.typography || theme.fontFamily)}`}
                style={{
                  backgroundColor: theme.backgroundColor,
                  borderColor: theme.borderColor,
                }}
              >
                {/* Header in Preview */}
                <div className="flex items-center gap-2 pb-3 mb-3 border-b" style={{ borderColor: theme.borderColor }}>
                  {branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.logoUrl}
                      alt="Brand Logo"
                      className="h-6 w-auto object-contain rounded"
                    />
                  ) : (
                    <div
                      className="h-6 w-6 rounded flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: branding.brandColor || "#4f46e5" }}
                    >
                      R
                    </div>
                  )}
                  <div>
                    <h4
                      className="text-xs font-bold leading-tight"
                      style={{ color: theme.textColor }}
                    >
                      {branding.title || dashboardTitle || "Executive Dashboard"}
                    </h4>
                    <p
                      className="text-[10px] leading-tight"
                      style={{ color: theme.textMutedColor }}
                    >
                      {branding.description || "Live performance analytics"}
                    </p>
                  </div>
                </div>

                {/* Sample Card 1: KPI */}
                <div
                  className="p-3 mb-2.5 transition-all"
                  style={{
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.borderColor,
                    borderRadius: getRadiusStyle(theme.cardRadius),
                    boxShadow: getShadowStyle(theme.cardShadow, theme.mode === "dark"),
                    borderWidth: 1,
                  }}
                >
                  <span className="text-[10px] uppercase font-bold" style={{ color: theme.textMutedColor }}>
                    Total Revenue
                  </span>
                  <div className="text-lg font-black mt-0.5" style={{ color: theme.textColor }}>
                    $1,482,900
                  </div>
                  <span
                    className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${branding.brandColor || "#4f46e5"}20`,
                      color: branding.brandColor || "#4f46e5",
                    }}
                  >
                    +18.4% vs last month
                  </span>
                </div>

                {/* Sample Card 2: Chart Bar Preview */}
                <div
                  className="p-3 transition-all"
                  style={{
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.borderColor,
                    borderRadius: getRadiusStyle(theme.cardRadius),
                    boxShadow: getShadowStyle(theme.cardShadow, theme.mode === "dark"),
                    borderWidth: 1,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold" style={{ color: theme.textColor }}>
                      Regional Distribution
                    </span>
                    <span className="text-[9px]" style={{ color: theme.textMutedColor }}>
                      Live
                    </span>
                  </div>
                  {/* Fake bars with palette colors */}
                  <div className="space-y-1.5">
                    {theme.chartPalette.slice(0, 3).map((col, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] w-8 font-mono" style={{ color: theme.textMutedColor }}>
                          Cat {idx + 1}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: col,
                              width: `${85 - idx * 25}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Help Note */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-800 text-[11px] text-gray-400">
              Settings persist to the database and will apply to all viewers and shared link recipients.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => handleSelectPreset("default")}
            className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 font-medium transition"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Apply & Save Theme</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
