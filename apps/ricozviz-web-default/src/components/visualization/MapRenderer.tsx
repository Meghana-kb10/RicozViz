"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  MapPin,
  CircleDot,
  Layers,
  ChevronDown,
  Info,
  Maximize2,
  X,
  Filter,
} from "lucide-react";
import type { ChartConfig } from "../../lib/api";
import {
  processAndValidateGeoData,
  projectCoordinates,
  SVG_MAP_WIDTH,
  SVG_MAP_HEIGHT,
  WORLD_BASE_PATHS,
  GEO_PALETTES,
  interpolateGeoColor,
  type ColorPaletteName,
  type GeoPoint,
  type GeoRegion,
} from "../../lib/geo-utils";

export interface MapRendererProps {
  data: {
    rows: Record<string, unknown>[];
    columns?: Array<{ name: string; type: string }>;
  };
  config: ChartConfig;
  height?: number | string;
  onDataPointClick?: (field: string, value: unknown) => void;
  selectedFilterValue?: unknown;
  onClearFilter?: () => void;
}

export type MapType = "CHOROPLETH" | "BUBBLE" | "MARKER";

export function MapRenderer({
  data,
  config,
  height = 360,
  onDataPointClick,
  selectedFilterValue,
  onClearFilter,
}: MapRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Map Type (from options or user toggle)
  const defaultMapType =
    (config.options?.mapType as MapType) ||
    ((config as { chartType?: string }).chartType === "BUBBLE" ? "BUBBLE" : "CHOROPLETH");
  const [activeMapType, setActiveMapType] = useState<MapType>(defaultMapType);

  // Color Palette
  const defaultPalette = (config.options?.colorScale as ColorPaletteName) || "indigo";
  const [activePalette, setActivePalette] = useState<ColorPaletteName>(defaultPalette);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    value: string;
    subtitle?: string;
    coordinates?: string;
  } | null>(null);

  // Show warnings collapse
  const [showWarnings, setShowWarnings] = useState(false);

  // Process & Validate Geospatial Data
  const geoResult = useMemo(() => {
    return processAndValidateGeoData(
      data.rows || [],
      data.columns || [],
      config as unknown as Record<string, unknown>
    );
  }, [data.rows, data.columns, config]);

  // Handle Zoom In / Out / Reset
  const handleZoomIn = () => setZoom((z) => Math.min(6, z * 1.3));
  const handleZoomOut = () => setZoom((z) => Math.max(0.7, z / 1.3));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse Drag Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary button
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Click Handler for Region / Bubble / Marker
  const handleEntityClick = useCallback(
    (name: string, regionCode?: string) => {
      if (!onDataPointClick) return;
      const targetField = geoResult.geoColumnName || "country";
      // Toggle value or apply filter
      onDataPointClick(targetField, regionCode || name);
    },
    [onDataPointClick, geoResult.geoColumnName]
  );

  // Check if unmappable error
  if (geoResult.error) {
    return (
      <div
        style={{ height }}
        className="w-full flex flex-col items-center justify-center rounded-xl bg-amber-50/60 border border-amber-200 p-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-2 shadow-2xs">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h5 className="text-xs font-bold text-amber-900">Geographic Data Validation Warning</h5>
        <p className="mt-1 text-xs text-amber-700 max-w-md leading-relaxed">{geoResult.error}</p>
        <span className="mt-2 text-[11px] text-gray-500">
          Ensure your dataset includes valid coordinates (Latitude: -90 to 90, Longitude: -180 to 180) or standardized country/state names.
        </span>
      </div>
    );
  }

  const { validPoints, validRegions, minMetric, maxMetric, warnings } = geoResult;
  const metricSpan = maxMetric - minMetric || 1;

  // Active selection matching
  const isSelected = (val: string, code?: string) => {
    if (!selectedFilterValue) return false;
    const str = String(selectedFilterValue).toLowerCase();
    return str === val.toLowerCase() || (code && str === code.toLowerCase());
  };

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full relative flex flex-col rounded-xl overflow-hidden select-none bg-slate-900/5 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Map Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Map Type Switcher */}
        <div className="pointer-events-auto flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-lg p-0.5 shadow-xs border border-gray-200 dark:border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setActiveMapType("CHOROPLETH")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
              activeMapType === "CHOROPLETH"
                ? "bg-indigo-600 text-white shadow-2xs font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
            title="Choropleth: Color regions by metric value"
          >
            <Layers className="h-3 w-3" />
            <span className="hidden sm:inline">Choropleth</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMapType("BUBBLE")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
              activeMapType === "BUBBLE"
                ? "bg-indigo-600 text-white shadow-2xs font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
            title="Bubble Map: Proportional circles by metric magnitude"
          >
            <CircleDot className="h-3 w-3" />
            <span className="hidden sm:inline">Bubble</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMapType("MARKER")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
              activeMapType === "MARKER"
                ? "bg-indigo-600 text-white shadow-2xs font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
            title="Marker Map: Exact coordinates pinpoint pins"
          >
            <MapPin className="h-3 w-3" />
            <span className="hidden sm:inline">Markers</span>
          </button>
        </div>

        {/* Right: Zoom / Pan / Palette Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Active selection badge */}
          {selectedFilterValue != null && selectedFilterValue !== "" ? (
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded-md text-[11px] font-semibold shadow-2xs">
              <Filter className="h-3 w-3 text-indigo-600" />
              <span>{String(selectedFilterValue)}</span>
              {onClearFilter && (
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="hover:text-red-600 ml-0.5"
                  title="Clear map filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : null}

          {/* Palette Selector */}
          <select
            value={activePalette}
            onChange={(e) => setActivePalette(e.target.value as ColorPaletteName)}
            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-[11px] rounded-lg px-2 py-1 shadow-xs focus:outline-none"
            title="Color Palette"
          >
            <option value="indigo">Indigo</option>
            <option value="emerald">Emerald</option>
            <option value="amber">Amber</option>
            <option value="rose">Rose</option>
            <option value="blue">Blue</option>
            <option value="slate">Monochrome</option>
          </select>

          {/* Zoom controls */}
          <div className="flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-lg p-0.5 shadow-xs border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="p-1 rounded text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Warning Alert Banner (if data issues detected) */}
      {warnings.length > 0 && (
        <div className="absolute bottom-2.5 left-2.5 z-20 max-w-md">
          <div className="bg-amber-50/95 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg p-2 text-[11px] shadow-sm backdrop-blur-xs flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{warnings[0]}</span>
                {warnings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowWarnings(!showWarnings)}
                    className="text-[10px] text-amber-700 dark:text-amber-300 underline font-medium ml-2"
                  >
                    {showWarnings ? "Hide" : `+${warnings.length - 1} more`}
                  </button>
                )}
              </div>
              {showWarnings && (
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-[10px] text-amber-800 dark:text-amber-300">
                  {warnings.slice(1).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive SVG Canvas */}
      <div
        className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <svg
          viewBox={`0 0 ${SVG_MAP_WIDTH} ${SVG_MAP_HEIGHT}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        >
          {/* Subtle Background Grid Lines (Equator, Prime Meridian, Tropics) */}
          <g className="stroke-slate-200/50 dark:stroke-slate-700/30 stroke-[0.5]" strokeDasharray="3 3">
            <line x1="0" y1="250" x2={SVG_MAP_WIDTH} y2="250" />
            <line x1="480" y1="0" x2="480" y2={SVG_MAP_HEIGHT} />
            <line x1="0" y1="184" x2={SVG_MAP_WIDTH} y2="184" />
            <line x1="0" y1="316" x2={SVG_MAP_WIDTH} y2="316" />
          </g>

          {/* 1. Base World Continents / Countries Polygons */}
          <g className="world-base-paths">
            {WORLD_BASE_PATHS.map((poly) => {
              const matchedRegion = validRegions.find((r) => r.code === poly.code);
              const hasData = Boolean(matchedRegion);
              const active = isSelected(poly.name, poly.code);

              // Choropleth shading
              let fillColor = "#e2e8f0"; // Default neutral
              if (activeMapType === "CHOROPLETH" && matchedRegion) {
                const ratio = (matchedRegion.value - minMetric) / metricSpan;
                fillColor = interpolateGeoColor(ratio, activePalette);
              } else if (hasData) {
                fillColor = "#cbd5e1";
              }

              return (
                <path
                  key={poly.code}
                  d={poly.d}
                  fill={fillColor}
                  stroke={active ? "#4f46e5" : "#94a3b8"}
                  strokeWidth={active ? 2.5 : 0.75}
                  className="transition-colors duration-200 cursor-pointer hover:opacity-85"
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    setTooltip({
                      visible: true,
                      x: e.clientX - (rect?.left || 0),
                      y: e.clientY - (rect?.top || 0),
                      title: poly.name,
                      value: matchedRegion
                        ? `${matchedRegion.formattedValue} (${geoResult.metricColumnName})`
                        : "No data",
                      subtitle: hasData ? "Click to cross-filter dashboard" : undefined,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEntityClick(poly.name, poly.code);
                  }}
                />
              );
            })}
          </g>

          {/* 2. Bubble Map Layer */}
          {activeMapType === "BUBBLE" && (
            <g className="bubble-layer">
              {validPoints.map((pt) => {
                const { x, y } = projectCoordinates(pt.lat, pt.lng);
                const ratio = Math.max(0, Math.min(1, (pt.value - minMetric) / metricSpan));
                // Radius between 5 and 32 pixels
                const radius = 5 + Math.sqrt(ratio) * 27;
                const fillColor = interpolateGeoColor(ratio, activePalette);
                const active = isSelected(pt.name, pt.regionCode);

                return (
                  <g
                    key={pt.id}
                    className="cursor-pointer transition-transform duration-150 hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEntityClick(pt.name, pt.regionCode);
                    }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      setTooltip({
                        visible: true,
                        x: e.clientX - (rect?.left || 0),
                        y: e.clientY - (rect?.top || 0),
                        title: pt.name,
                        value: `${pt.formattedValue} (${geoResult.metricColumnName})`,
                        coordinates: `Lat: ${pt.lat.toFixed(2)}°, Lng: ${pt.lng.toFixed(2)}°`,
                        subtitle: "Click to filter dashboard",
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* Pulsing ring aura */}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius + 3}
                      fill={fillColor}
                      opacity={active ? 0.45 : 0.25}
                    />
                    {/* Main bubble */}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={fillColor}
                      fillOpacity={0.8}
                      stroke={active ? "#1e1b4b" : "#ffffff"}
                      strokeWidth={active ? 2.5 : 1.2}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* 3. Point / Marker Map Layer */}
          {activeMapType === "MARKER" && (
            <g className="marker-layer">
              {validPoints.map((pt) => {
                const { x, y } = projectCoordinates(pt.lat, pt.lng);
                const active = isSelected(pt.name, pt.regionCode);
                const accentColor = GEO_PALETTES[activePalette]?.accent || "#4f46e5";

                return (
                  <g
                    key={pt.id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer transition-transform duration-150 hover:scale-125"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEntityClick(pt.name, pt.regionCode);
                    }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      setTooltip({
                        visible: true,
                        x: e.clientX - (rect?.left || 0),
                        y: e.clientY - (rect?.top || 0),
                        title: pt.name,
                        value: `${pt.formattedValue} (${geoResult.metricColumnName})`,
                        coordinates: `Lat: ${pt.lat.toFixed(2)}°, Lng: ${pt.lng.toFixed(2)}°`,
                        subtitle: "Click to filter dashboard",
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* Marker Pinpoint SVG Icon */}
                    <circle cx="0" cy="0" r="4" fill={active ? "#1e1b4b" : accentColor} />
                    <circle
                      cx="0"
                      cy="0"
                      r="9"
                      fill="none"
                      stroke={accentColor}
                      strokeWidth="1.5"
                      opacity={0.7}
                      className="animate-ping"
                    />
                    <path
                      d="M -5 -6 C -5 -11, 5 -11, 5 -6 C 5 -2, 0 3, 0 3 C 0 3, -5 -2, -5 -6 Z"
                      fill={active ? "#1e1b4b" : accentColor}
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {tooltip && tooltip.visible && (
          <div
            className="absolute z-30 pointer-events-none rounded-lg bg-gray-900/95 text-white p-2.5 shadow-xl text-xs max-w-xs backdrop-blur-xs border border-gray-700/50"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 300) - 180),
              top: Math.max(tooltip.y - 45, 10),
            }}
          >
            <div className="font-bold text-slate-100 flex items-center justify-between gap-2">
              <span>{tooltip.title}</span>
            </div>
            <div className="mt-1 font-semibold text-indigo-300 font-mono text-[11px]">
              {tooltip.value}
            </div>
            {tooltip.coordinates && (
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                {tooltip.coordinates}
              </div>
            )}
            {tooltip.subtitle && (
              <div className="text-[10px] text-gray-400 italic mt-1 pt-1 border-t border-gray-800">
                {tooltip.subtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Choropleth Legend */}
      {activeMapType === "CHOROPLETH" && (
        <div className="absolute bottom-2.5 right-2.5 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-2 rounded-lg border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-700 dark:text-gray-200 font-mono">
            {minMetric.toLocaleString()}
          </span>
          <div className="flex h-2.5 w-24 rounded-full overflow-hidden border border-gray-200 dark:border-slate-700">
            {GEO_PALETTES[activePalette].ramp.map((c, i) => (
              <div key={i} style={{ backgroundColor: c }} className="flex-1 h-full" />
            ))}
          </div>
          <span className="font-semibold text-gray-700 dark:text-gray-200 font-mono">
            {maxMetric.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
