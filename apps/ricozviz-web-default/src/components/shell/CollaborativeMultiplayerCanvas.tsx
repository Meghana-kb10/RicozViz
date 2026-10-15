"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Users,
  MousePointer2,
  Lock,
  Unlock,
  MessageSquare,
  Play,
  Pause,
  Sparkles,
  Radio,
  RefreshCw,
  Maximize2,
  X,
  CheckCircle2,
  Activity,
  Zap,
  ShieldCheck,
} from "lucide-react";
import type { MultiplayerCursorIndicator, MultiplayerCanvasEvent } from "../../lib/api";

interface CollaborativeMultiplayerCanvasProps {
  compact?: boolean;
  className?: string;
}

interface ScriptedStep {
  sarah: {
    x: number;
    y: number;
    status: MultiplayerCursorIndicator["status"];
    actionText: string;
    isSelecting?: boolean;
    selectionBox?: { x: number; y: number; w: number; h: number };
  };
  david: {
    x: number;
    y: number;
    status: MultiplayerCursorIndicator["status"];
    actionText: string;
    lockedWidgetId?: string;
  };
  event: MultiplayerCanvasEvent;
}

const COLLABORATIVE_STEPS: ScriptedStep[] = [
  {
    sarah: {
      x: 28,
      y: 35,
      status: "inspecting",
      actionText: "Inspecting Q3 ARR Peak ($1.42M)",
      isSelecting: false,
    },
    david: {
      x: 74,
      y: 68,
      status: "idle",
      actionText: "Monitoring WASM buffer (8.2ms)",
    },
    event: {
      id: "ev-1",
      timestamp: "19:28:10.124",
      userId: "u-sarah",
      userName: "@Sarah",
      userRole: "Analyst",
      type: "POINT_INSPECT",
      description: "Inspected datapoint [Q3 Peak ARR: $1,420,000]",
      latencyMs: 9.4,
    },
  },
  {
    sarah: {
      x: 44,
      y: 42,
      status: "selecting",
      actionText: "Selecting range [Jul 14 - Aug 28]",
      isSelecting: true,
      selectionBox: { x: 25, y: 28, w: 32, h: 26 },
    },
    david: {
      x: 62,
      y: 30,
      status: "editing",
      actionText: "Acquiring lock on Query IDE",
      lockedWidgetId: "widget-query",
    },
    event: {
      id: "ev-2",
      timestamp: "19:28:12.430",
      userId: "u-david",
      userName: "@David",
      userRole: "Data Eng",
      type: "WIDGET_LOCK",
      description: "Acquired exclusive focus lock on [DuckDB SQL Query Node]",
      latencyMs: 11.2,
    },
  },
  {
    sarah: {
      x: 36,
      y: 52,
      status: "commenting",
      actionText: "Pinned comment: 'EMEA expansion driving +34% spike'",
      isSelecting: false,
    },
    david: {
      x: 78,
      y: 36,
      status: "editing",
      actionText: "Pushing SQL: WHERE tier = 'ENTERPRISE'",
      lockedWidgetId: "widget-query",
    },
    event: {
      id: "ev-3",
      timestamp: "19:28:14.882",
      userId: "u-sarah",
      userName: "@Sarah",
      userRole: "Analyst",
      type: "COMMENT_PINNED",
      description: "Pinned comment to Revenue widget: 'EMEA expansion driving +34% spike'",
      latencyMs: 8.6,
    },
  },
  {
    sarah: {
      x: 58,
      y: 22,
      status: "filtering",
      actionText: "Cross-filtering breakdown by EMEA",
      isSelecting: false,
    },
    david: {
      x: 82,
      y: 72,
      status: "idle",
      actionText: "Released lock • Optimistic merge applied (3.8ms)",
      lockedWidgetId: undefined,
    },
    event: {
      id: "ev-4",
      timestamp: "19:28:17.150",
      userId: "u-david",
      userName: "@David",
      userRole: "Data Eng",
      type: "OPTIMISTIC_MERGE",
      description: "Optimistic concurrency resolved 0 conflicts in 3.8ms (Version 14)",
      latencyMs: 4.2,
    },
  },
];

export function CollaborativeMultiplayerCanvas({
  compact = false,
  className = "",
}: CollaborativeMultiplayerCanvasProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventLog, setEventLog] = useState<MultiplayerCanvasEvent[]>([]);
  const [userCursor, setUserCursor] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });
  const [simulatedConflictNotice, setSimulatedConflictNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Cycle through scripted multiplayer steps
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = (4000 / speed);
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = (prev + 1) % COLLABORATIVE_STEPS.length;
        const currentStep = COLLABORATIVE_STEPS[next];
        if (currentStep) {
          setEventLog((log) => [currentStep.event, ...log].slice(0, 10));
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Seed initial event log
  useEffect(() => {
    const initialEvents = COLLABORATIVE_STEPS.map((s) => s.event);
    setEventLog(initialEvents);
  }, []);

  const activeStep = COLLABORATIVE_STEPS[currentStepIndex] || COLLABORATIVE_STEPS[0];
  const { sarah, david } = activeStep;

  // Track user interactive mouse movement on the canvas
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    setUserCursor({ x, y, active: true });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setUserCursor((prev) => ({ ...prev, active: false }));
  }, []);

  const handleTriggerConflictSimulation = useCallback(() => {
    setSimulatedConflictNotice("Simulating concurrent mutation lock...");
    setTimeout(() => {
      setSimulatedConflictNotice("🔒 Focus lock granted to @David. @Sarah queued via optimistic MVCC.");
      setTimeout(() => {
        setSimulatedConflictNotice("✅ Conflict-free merge completed in 3.4ms (No re-renders required)");
        setTimeout(() => setSimulatedConflictNotice(null), 3000);
      }, 1500);
    }, 800);
  }, []);

  return (
    <div className={`relative flex flex-col w-full h-full ${className}`}>
      {/* Top Presence & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#DADFD9] dark:border-[#374151] text-xs">
        {/* Collaborator Avatars with Live Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {/* Sarah Avatar */}
            <div
              className="relative inline-block"
              title="@Sarah (Lead Analyst) • Inspecting Canvas"
            >
              <span className="h-6 w-6 rounded-full bg-[#A855F7] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937] shadow-xs">
                SA
              </span>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-[#1F2937] animate-pulse" />
            </div>

            {/* David Avatar */}
            <div
              className="relative inline-block"
              title="@David (Data Engineer) • Editing Query Locks"
            >
              <span className="h-6 w-6 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937] shadow-xs">
                DA
              </span>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-[#1F2937] animate-pulse" />
            </div>

            {/* Alex Avatar (Idle) */}
            <div
              className="relative inline-block"
              title="@Alex (Architect) • Connected / Viewing"
            >
              <span className="h-6 w-6 rounded-full bg-[#F59E0B] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937] shadow-xs">
                AL
              </span>
              <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-white dark:ring-[#1F2937]" />
            </div>

            {/* User Presence Avatar */}
            {userCursor.active && (
              <div
                className="relative inline-block animate-fadeIn"
                title="@You (Guest Analyst) • Active On Canvas"
              >
                <span className="h-6 w-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937] shadow-xs">
                  YOU
                </span>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-sky-400 ring-1 ring-white dark:ring-[#1F2937] animate-pulse" />
              </div>
            )}
          </div>

          <span className="text-[11px] font-medium text-[#172B3A] dark:text-[#E5E7EB]">
            {userCursor.active ? "3 Live Collaborators" : "2 Live Collaborators"}
          </span>
        </div>

        {/* Sync Telemetry & Controls */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            <span>12ms SSE</span>
          </span>

          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="p-1 rounded border border-[#DADFD9] dark:border-[#374151] hover:bg-[#F4F1EA] dark:hover:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] transition cursor-pointer"
            title={isPlaying ? "Pause Multiplayer Simulation" : "Play Multiplayer Simulation"}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
            className="px-1.5 py-0.5 rounded border border-[#DADFD9] dark:border-[#374151] hover:bg-[#F4F1EA] dark:hover:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] font-bold transition cursor-pointer"
            title="Toggle simulation speed"
          >
            {speed}x
          </button>

          {/* Expand Full Sandbox Modal */}
          {compact && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="p-1 rounded border border-[#DADFD9] dark:border-[#374151] hover:bg-[#F4F1EA] dark:hover:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] transition cursor-pointer"
              title="Expand Collaborative Sandbox"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas Board */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative mt-3 rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-[#F8FAFC] dark:bg-[#0B0F17] overflow-hidden select-none transition-colors ${
          compact ? "h-52 sm:h-56" : "h-72 sm:h-80"
        }`}
      >
        {/* Subtle Canvas Dot Grid Matrix */}
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #94A3B8 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Canvas Widget 1: Revenue & Trajectory Card */}
        <div
          className={`absolute left-3 top-3 w-[56%] rounded-lg border bg-white dark:bg-[#151B24] p-3 shadow-xs transition-all duration-300 ${
            sarah.status === "selecting"
              ? "border-[#A855F7]/60 ring-2 ring-[#A855F7]/15"
              : "border-[#E2E8F0] dark:border-[#1F2937]"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-[#596775] dark:text-[#9CA3AF] font-mono mb-1.5">
            <span className="font-semibold text-[#172B3A] dark:text-[#E5E7EB]">
              Q3 ARR Cohorts
            </span>
            <span className="text-emerald-500 font-bold">+28.4%</span>
          </div>

          {/* Mini Mock Spline/Bars */}
          <div className="flex items-end gap-1.5 h-14 pt-2">
            {[42, 58, 48, 76, 68, 92, 85].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    i === 5
                      ? "bg-[#A855F7] shadow-xs"
                      : "bg-[#147D78]/25 dark:bg-[#4F9D8E]/30 hover:bg-[#147D78]/40"
                  }`}
                  style={{ height: `${val}%` }}
                />
              </div>
            ))}
          </div>

          {/* Sarah Selection Box overlay when dragging */}
          {sarah.isSelecting && sarah.selectionBox && (
            <div
              className="absolute border border-dashed border-[#A855F7] bg-[#A855F7]/10 rounded pointer-events-none transition-all duration-300"
              style={{
                left: `${sarah.selectionBox.x}%`,
                top: `${sarah.selectionBox.y}%`,
                width: `${sarah.selectionBox.w}%`,
                height: `${sarah.selectionBox.h}%`,
              }}
            >
              <span className="absolute -top-3.5 left-0 text-[8.5px] font-mono bg-[#A855F7] text-white px-1 rounded">
                Range: Jul 14 - Aug 28
              </span>
            </div>
          )}
        </div>

        {/* Canvas Widget 2: DuckDB Query Engine Node */}
        <div
          className={`absolute right-3 top-3 w-[36%] rounded-lg border bg-white dark:bg-[#151B24] p-3 shadow-xs transition-all duration-300 ${
            david.lockedWidgetId === "widget-query"
              ? "border-emerald-500/80 ring-2 ring-emerald-500/20"
              : "border-[#E2E8F0] dark:border-[#1F2937]"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono mb-2">
            <span className="font-semibold text-[#172B3A] dark:text-[#E5E7EB] flex items-center gap-1">
              <Activity className="w-3 h-3 text-[#10B981]" />
              <span>DuckDB IDE</span>
            </span>
            {david.lockedWidgetId === "widget-query" ? (
              <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/30">
                <Lock className="w-2.5 h-2.5" />
                <span>Locked by David</span>
              </span>
            ) : (
              <span className="text-gray-400 text-[8.5px]">
                <Unlock className="w-2.5 h-2.5 inline mr-0.5" />
                Shared
              </span>
            )}
          </div>

          <div className="space-y-1 text-[9.5px] font-mono text-[#596775] dark:text-[#9CA3AF]">
            <div className="p-1 rounded bg-[#F1F5F9] dark:bg-[#0B0F17] border border-[#E2E8F0] dark:border-[#1F2937] truncate">
              SELECT date_trunc(&apos;day&apos;, ts)
            </div>
            <div className="flex items-center justify-between text-[9px] pt-1">
              <span>Latency:</span>
              <span className="text-emerald-500 font-bold">4.2ms WASM</span>
            </div>
          </div>
        </div>

        {/* Canvas Widget 3: Live Real-Time Multi-Tenant Presence Stream */}
        <div className="absolute left-3 bottom-3 right-3 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] bg-white/90 dark:bg-[#151B24]/90 backdrop-blur-xs px-3 py-1.5 flex items-center justify-between text-[10.5px] font-mono">
          <div className="flex items-center gap-2 truncate">
            <Zap className="w-3.5 h-3.5 text-[#147D78] dark:text-[#4F9D8E] shrink-0" />
            <span className="text-[#596775] dark:text-[#9CA3AF] truncate">
              {simulatedConflictNotice || (
                <>
                  <strong className="text-[#172B3A] dark:text-[#E5E7EB]">
                    {activeStep.event.userName}
                  </strong>{" "}
                  {activeStep.event.description}
                </>
              )}
            </span>
          </div>
          <span className="text-[9px] text-[#9CA3AF] shrink-0 hidden sm:inline">
            Optimistic Concurrency (OCC)
          </span>
        </div>

        {/* ======================================================== */}
        {/* LIVE MULTIPLAYER CURSORS LAYER                           */}
        {/* ======================================================== */}

        {/* 1. @Sarah (Analyst) Cursor */}
        <div
          className="absolute pointer-events-none transition-all duration-700 ease-out z-30"
          style={{
            left: `${sarah.x}%`,
            top: `${sarah.y}%`,
            transform: "translate(0, 0)",
          }}
        >
          {/* Custom SVG Cursor Arrow */}
          <svg
            className="w-4 h-4 text-[#A855F7] drop-shadow-md"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
          >
            <path d="M3 3l7 18 3.5-7.5L21 10z" />
          </svg>

          {/* Name & Role Pill */}
          <div className="ml-3 -mt-1 inline-flex flex-col items-start">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold text-white bg-[#A855F7] shadow-xs whitespace-nowrap flex items-center gap-1">
              <span>@Sarah (Analyst)</span>
            </span>

            {/* Action Callout Tooltip */}
            {sarah.actionText && (
              <span className="mt-1 px-2 py-0.5 rounded-md text-[8.5px] font-mono text-[#172B3A] dark:text-[#E5E7EB] bg-white/95 dark:bg-[#1F2937]/95 border border-[#A855F7]/40 shadow-md whitespace-nowrap animate-fadeIn">
                {sarah.actionText}
              </span>
            )}
          </div>
        </div>

        {/* 2. @David (Data Eng) Cursor */}
        <div
          className="absolute pointer-events-none transition-all duration-700 ease-out z-30"
          style={{
            left: `${david.x}%`,
            top: `${david.y}%`,
            transform: "translate(0, 0)",
          }}
        >
          {/* Custom SVG Cursor Arrow */}
          <svg
            className="w-4 h-4 text-[#10B981] drop-shadow-md"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
          >
            <path d="M3 3l7 18 3.5-7.5L21 10z" />
          </svg>

          {/* Name & Role Pill */}
          <div className="ml-3 -mt-1 inline-flex flex-col items-start">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold text-white bg-[#10B981] shadow-xs whitespace-nowrap flex items-center gap-1">
              <span>@David (Data Eng)</span>
            </span>

            {/* Action Callout Tooltip */}
            {david.actionText && (
              <span className="mt-1 px-2 py-0.5 rounded-md text-[8.5px] font-mono text-[#172B3A] dark:text-[#E5E7EB] bg-white/95 dark:bg-[#1F2937]/95 border border-[#10B981]/40 shadow-md whitespace-nowrap animate-fadeIn">
                {david.actionText}
              </span>
            )}
          </div>
        </div>

        {/* 3. Interactive User Cursor (@You) */}
        {userCursor.active && (
          <div
            className="absolute pointer-events-none z-40 transition-transform duration-75"
            style={{
              left: `${userCursor.x}%`,
              top: `${userCursor.y}%`,
            }}
          >
            <svg
              className="w-4 h-4 text-[#0EA5E9] drop-shadow-md"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="white"
              strokeWidth="1.5"
            >
              <path d="M3 3l7 18 3.5-7.5L21 10z" />
            </svg>
            <div className="ml-3 -mt-1 inline-flex flex-col items-start">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold text-white bg-[#0EA5E9] shadow-xs whitespace-nowrap">
                @You (Guest Analyst)
              </span>
              <span className="mt-0.5 text-[8px] font-mono text-[#0EA5E9] font-medium bg-white/90 dark:bg-[#111827]/90 px-1 rounded shadow-2xs">
                x:{Math.round(userCursor.x)}% y:{Math.round(userCursor.y)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls & Interactive Simulation Trigger */}
      <div className="mt-2.5 pt-2 border-t border-[#DADFD9] dark:border-[#374151] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerConflictSimulation}
            className="px-2 py-1 rounded-md text-[10.5px] font-mono font-semibold bg-[#147D78]/10 hover:bg-[#147D78]/20 dark:bg-[#4F9D8E]/15 dark:hover:bg-[#4F9D8E]/25 text-[#147D78] dark:text-[#4F9D8E] border border-[#147D78]/30 dark:border-[#4F9D8E]/40 transition flex items-center gap-1 cursor-pointer"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Simulate Concurrency Lock</span>
          </button>
        </div>

        <span className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">
          Hover canvas to broadcast cursor
        </span>
      </div>

      {/* Expanded Modal Sandbox View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#374151] bg-[#111827] p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#374151] pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#4F9D8E]/10 border border-[#4F9D8E]/30 text-[#4F9D8E]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#E5E7EB] font-heading">
                    Real-Time Multiplayer Canvas Sandbox
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Live collaborative cursors, widget focus locks, and conflict-safe optimistic concurrency control.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg border border-[#374151] text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-[#1F2937] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Large Sandbox Canvas */}
            <div className="flex-1 overflow-y-auto space-y-4">
              <CollaborativeMultiplayerCanvas compact={false} />

              {/* Event Stream Audit Table */}
              <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 text-xs font-mono">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#374151]">
                  <span className="font-bold text-[#E5E7EB]">
                    Multiplayer Event Broadcast Log (SSE)
                  </span>
                  <span className="text-[#4F9D8E] text-[10px]">
                    0 Packet Drops • SHA-256 State Hashing
                  </span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {eventLog.map((ev, i) => (
                    <div
                      key={ev.id + i}
                      className="flex items-center justify-between py-1 px-2 rounded bg-[#111827] border border-[#374151]/50 text-[11px]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[#9CA3AF] text-[10px]">{ev.timestamp}</span>
                        <span
                          className={`font-semibold px-1 rounded text-[10px] ${
                            ev.userName === "@Sarah"
                              ? "bg-purple-950 text-purple-300"
                              : "bg-emerald-950 text-emerald-300"
                          }`}
                        >
                          {ev.userName}
                        </span>
                        <span className="text-[#E5E7EB] truncate">{ev.description}</span>
                      </div>
                      <span className="text-[#4F9D8E] text-[10px] shrink-0 font-semibold">
                        {ev.latencyMs}ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-[#374151] flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Powered by Ricoz Real-Time Protocol</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#147D78] hover:bg-[#106963] text-white font-medium transition cursor-pointer"
              >
                Close Sandbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
