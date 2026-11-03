'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  apiAdminGetWorkerHealth,
  apiAdminListWorkerRuns,
  apiAdminTriggerWorkerJob
} from '@repo/api';
import type { WorkerRun, WorkerHealthStatus, WorkerRunStatus } from '@repo/types';
import { StatusBadge, DataTable, ConfirmDialog, useToast } from '@repo/components';
import {
  Cpu,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  Layers,
  Calendar
} from 'lucide-react';

const REGISTERED_JOBS = [
  {
    name: 'scheduledRefreshWorker',
    title: 'Dataset Refresh Engine',
    description: 'Polls external database connectors, executes scheduled queries, and updates cached datasets.',
    schedule: 'Every 5 minutes'
  },
  {
    name: 'scheduledAlertWorker',
    title: 'Alert Evaluator & Dispatcher',
    description: 'Evaluates metric thresholds, detects anomalies, and sends email/webhook notifications.',
    schedule: 'Every 1 minute'
  },
  {
    name: 'scheduledReportWorker',
    title: 'Automated Report Compiler',
    description: 'Renders dashboard snapshots, compiles scheduled PDF/CSV packages, and distributes to subscribers.',
    schedule: 'Daily at 08:00 UTC'
  }
];

export default function AdminWorkersPage() {
  const { showToast } = useToast();
  const [health, setHealth] = useState<WorkerHealthStatus | null>(null);
  const [runs, setRuns] = useState<WorkerRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Trigger modal state
  const [selectedJobToTrigger, setSelectedJobToTrigger] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthData, runsData] = await Promise.all([
        apiAdminGetWorkerHealth().catch(() => null),
        apiAdminListWorkerRuns({
          jobName: jobFilter === 'ALL' ? undefined : jobFilter,
          status: statusFilter === 'ALL' ? undefined : (statusFilter as WorkerRunStatus),
          limit: 20
        }).catch(() => ({ runs: [], total: 0 }))
      ]);

      setHealth(healthData);
      setRuns(runsData.runs || []);
      setTotal(runsData.total || 0);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to fetch worker state' });
    } finally {
      setLoading(false);
    }
  }, [jobFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTriggerJob = async () => {
    if (!selectedJobToTrigger) return;
    setTriggerLoading(true);
    try {
      const result = await apiAdminTriggerWorkerJob(selectedJobToTrigger);
      showToast({
        type: 'success',
        title: 'Job Triggered',
        message: `Execution dispatched for ${selectedJobToTrigger}. Check run history.`
      });
      setSelectedJobToTrigger(null);
      fetchData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to trigger worker job' });
    } finally {
      setTriggerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              Worker Orchestration Engine
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Distributed background jobs, MongoDB lease locks, and execution audit history.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-gray-300 hover:text-white bg-[#141414] hover:bg-[#1f1f1f] border border-[#2b2b2b] rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Worker Health Banner */}
      <div className="p-5 bg-[#141414] border border-[#242424] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              health?.status === 'healthy'
                ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-400'
                : 'bg-red-950/40 border border-red-800/40 text-red-400'
            }`}
          >
            <Activity className="w-6 h-6" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono text-white">
                Cluster Daemon State:
              </span>
              <StatusBadge
                status={health?.status === 'healthy' ? 'ok' : 'failed'}
                label={(health?.status || 'UNKNOWN').toUpperCase()}
              />
            </div>
            <p className="text-xs text-gray-400 font-mono">
              MongoDB Lease Locks Held:{' '}
              <span className="text-white font-semibold">{health?.locksHeld ?? 0} active</span>
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-gray-400 text-right">
          <span>Worker Process: Isolated Entrypoint (`worker.ts`)</span>
        </div>
      </div>

      {/* Registered Job Catalog */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
          Registered Distributed Jobs
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REGISTERED_JOBS.map((job) => (
            <div
              key={job.name}
              className="p-5 bg-[#141414] border border-[#242424] hover:border-[#333] rounded-2xl flex flex-col justify-between transition space-y-4 shadow-lg"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold font-mono text-white">{job.title}</span>
                  <span className="px-2 py-0.5 text-[9px] font-mono bg-[#1c1c1c] text-gray-400 border border-[#2c2c2c] rounded">
                    {job.schedule}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{job.description}</p>
                <div className="text-[10px] font-mono text-gray-500 truncate">
                  fn: {job.name}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedJobToTrigger(job.name)}
                className="w-full py-2 px-3 text-xs font-mono font-medium text-white bg-[#ff6b35]/15 hover:bg-[#ff6b35]/25 border border-[#ff6b35]/30 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-[#ff6b35] fill-[#ff6b35]" />
                <span>Trigger Job Now</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Execution Log */}
      <div className="space-y-3 pt-4 border-t border-[#222]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
              Execution Run History ({total})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-[#121212] border border-[#262626] rounded-lg text-gray-300 focus:outline-none"
            >
              <option value="ALL">All Jobs</option>
              {REGISTERED_JOBS.map((j) => (
                <option key={j.name} value={j.name}>
                  {j.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-[#121212] border border-[#262626] rounded-lg text-gray-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
              <option value="SKIPPED">Skipped</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={[
            {
              key: 'jobName',
              header: 'Job Identifier',
              render: (run) => (
                <span className="font-mono text-xs font-semibold text-white">
                  {run.jobName}
                </span>
              )
            },
            {
              key: 'status',
              header: 'Status',
              render: (run) => (
                <StatusBadge
                  status={
                    run.status === 'SUCCESS'
                      ? 'ok'
                      : run.status === 'RUNNING'
                      ? 'running'
                      : run.status === 'FAILED'
                      ? 'failed'
                      : 'skipped'
                  }
                  label={run.status}
                />
              )
            },
            {
              key: 'attempt',
              header: 'Attempt',
              render: (run) => (
                <span className="font-mono text-[11px] text-gray-400">
                  #{run.attempt ?? 1}
                </span>
              )
            },
            {
              key: 'itemsProcessed',
              header: 'Processed',
              render: (run) => (
                <span className="font-mono text-[11px] text-gray-300">
                  {run.itemsProcessed ?? 0} items
                </span>
              )
            },
            {
              key: 'durationMs',
              header: 'Duration',
              render: (run) => (
                <span className="font-mono text-[11px] text-gray-400">
                  {run.durationMs ? `${run.durationMs}ms` : '—'}
                </span>
              )
            },
            {
              key: 'startedAt',
              header: 'Started At',
              render: (run) => (
                <span className="font-mono text-[11px] text-gray-400">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
              )
            },
            {
              key: 'error',
              header: 'Error Details',
              render: (run) =>
                run.error ? (
                  <span className="font-mono text-[10px] text-red-400 truncate max-w-[180px] block" title={run.error}>
                    {run.error}
                  </span>
                ) : (
                  <span className="text-gray-600 text-[10px] font-mono">—</span>
                )
            }
          ]}
          data={runs}
          keyExtractor={(run) => run.id || (run as any)._id || `${run.jobName}-${run.startedAt}`}
          emptyMessage="No historical worker runs found."
          isLoading={loading}
        />
      </div>

      {/* Manual Trigger Dialog */}
      {selectedJobToTrigger && (
        <ConfirmDialog
          isOpen={true}
          title={`Manual Worker Trigger: ${selectedJobToTrigger}`}
          description={`Triggering this job will request an immediate run outside its scheduled cron cycle. A distributed lease lock will be acquired to ensure single execution.`}
          confirmLabel="Dispatch Job"
          variant="warning"
          isLoading={triggerLoading}
          onConfirm={handleTriggerJob}
          onCancel={() => setSelectedJobToTrigger(null)}
        />
      )}
    </div>
  );
}
