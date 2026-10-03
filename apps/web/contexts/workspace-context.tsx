"use client";

// ========================================
// Workspace Context
// ========================================
// Manages workspace list, active workspace selection,
// creation, updates, and persistence across user sessions.
// ========================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./auth-context";
import {
  apiListWorkspaces,
  apiCreateWorkspace,
  apiUpdateWorkspace,
  apiDeleteWorkspace,
  type WorkspaceData,
} from "../lib/api";

const CURRENT_WORKSPACE_STORAGE_KEY = "ricozviz_current_ws";

interface WorkspaceContextValue {
  workspaces: WorkspaceData[];
  currentWorkspace: WorkspaceData | null;
  isLoading: boolean;
  error: string | null;
  selectWorkspace: (id: string) => void;
  createWorkspace: (input: { name: string; description?: string }) => Promise<WorkspaceData>;
  updateWorkspace: (id: string, input: { name?: string; description?: string | null }) => Promise<WorkspaceData>;
  deleteWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { auth, isLoading: authLoading } = useAuth();

  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    if (!auth) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const list = await apiListWorkspaces();
      setWorkspaces(list);

      // Determine active workspace:
      // 1. Saved preference in storage
      // 2. First workspace in list
      // 3. Null if none exist
      const savedId =
        typeof window !== "undefined"
          ? localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY)
          : null;

      const matched = list.find((ws) => ws.id === savedId);
      const active = matched ?? list[0] ?? null;

      setCurrentWorkspace(active);
      if (active && typeof window !== "undefined") {
        localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, active.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load workspaces";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void refreshWorkspaces();
    }
  }, [auth, authLoading, refreshWorkspaces]);

  const selectWorkspace = useCallback(
    (id: string) => {
      const selected = workspaces.find((ws) => ws.id === id);
      if (selected) {
        setCurrentWorkspace(selected);
        if (typeof window !== "undefined") {
          localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, selected.id);
        }
      }
    },
    [workspaces]
  );

  const createWorkspace = useCallback(
    async (input: { name: string; description?: string }): Promise<WorkspaceData> => {
      const created = await apiCreateWorkspace(input);
      setWorkspaces((prev) => [created, ...prev]);
      setCurrentWorkspace(created);
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, created.id);
      }
      return created;
    },
    []
  );

  const updateWorkspace = useCallback(
    async (
      id: string,
      input: { name?: string; description?: string | null }
    ): Promise<WorkspaceData> => {
      const updated = await apiUpdateWorkspace(id, input);
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === id ? { ...ws, ...updated } : ws))
      );
      setCurrentWorkspace((curr) => (curr?.id === id ? { ...curr, ...updated } : curr));
      return updated;
    },
    []
  );

  const deleteWorkspace = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteWorkspace(id);
      setWorkspaces((prev) => {
        const remaining = prev.filter((ws) => ws.id !== id);
        if (currentWorkspace?.id === id) {
          const next = remaining[0] ?? null;
          setCurrentWorkspace(next);
          if (next && typeof window !== "undefined") {
            localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, next.id);
          } else if (typeof window !== "undefined") {
            localStorage.removeItem(CURRENT_WORKSPACE_STORAGE_KEY);
          }
        }
        return remaining;
      });
    },
    [currentWorkspace]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        isLoading,
        error,
        selectWorkspace,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
