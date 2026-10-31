import { useQuery } from '@tanstack/react-query';
import {
  X,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  BarChart2,
} from 'lucide-react';
import { projectsApi, type ProjectAnalytics } from '../../lib/api';

interface ProjectAnalyticsModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectAnalyticsModal({
  projectId,
  projectName,
  isOpen,
  onClose,
}: ProjectAnalyticsModalProps) {
  const {
    data: analytics,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ProjectAnalytics>({
    queryKey: ['project-analytics', projectId],
    queryFn: () => projectsApi.getAnalytics(projectId),
    enabled: isOpen && Boolean(projectId),
    staleTime: 5000,
  });

  if (!isOpen) return null;

  const summary = analytics?.summary || {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    successRate: 100,
    totalTokens: 0,
    averageDurationMs: 0,
    averageTokens: 0,
  };

  const recentExecutions = analytics?.recentExecutions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden text-neutral-200">
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 px-6 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <BarChart2 className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Execution & Token Analytics</h2>
                <span className="text-xs text-neutral-400">• {projectName}</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Production telemetry, model token spend, and execution latency
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title="Refresh telemetry metrics"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ── Modal Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <span className="text-xs text-neutral-400">Loading execution telemetry...</span>
              </div>
            </div>
          ) : (
            <>
              {/* ── 4 KPI Summary Cards ────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Runs & Success Rate */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Total Runs</span>
                    <Activity className="size-4 text-brand-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-white">
                      {summary.totalExecutions.toLocaleString()}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        summary.successRate >= 95
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                          : summary.successRate >= 80
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                          : 'bg-red-950 text-red-400 border border-red-800/40'
                      }`}
                    >
                      {summary.successRate}% Success
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400 flex items-center gap-2 pt-1">
                    <span className="text-emerald-400">{summary.successfulExecutions} passed</span>
                    <span>•</span>
                    <span className="text-red-400">{summary.failedExecutions} failed</span>
                  </div>
                </div>

                {/* 2. Total Tokens Consumed */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Total Tokens Consumed</span>
                    <Zap className="size-4 text-amber-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-white">
                      {summary.totalTokens.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">Tokens</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 pt-1">
                    Gemini Flash-Lite primary & fallback models
                  </div>
                </div>

                {/* 3. Average Execution Latency */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Avg Latency / Turn</span>
                    <Clock className="size-4 text-sky-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-white">
                      {summary.averageDurationMs < 1000
                        ? `${summary.averageDurationMs}ms`
                        : `${(summary.averageDurationMs / 1000).toFixed(2)}s`}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">Fast</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 pt-1">
                    End-to-end Python engine processing
                  </div>
                </div>

                {/* 4. Average Tokens per Run */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Avg Tokens / Run</span>
                    <Layers className="size-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-white">
                      {summary.averageTokens.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">Tokens</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 pt-1">
                    Input prompts, system context & output
                  </div>
                </div>
              </div>

              {/* ── Recent Executions Log ─────────────────────────────── */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-900/60">
                  <div className="flex items-center gap-2">
                    <Activity className="size-3.5 text-brand-400" />
                    <span className="text-xs font-semibold text-white">Recent Workflow Executions</span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      ({recentExecutions.length} recorded)
                    </span>
                  </div>
                </div>

                {recentExecutions.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-400">
                      <Activity className="size-5" />
                    </div>
                    <div className="text-xs font-medium text-white">No Executions Recorded Yet</div>
                    <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                      Interact with your agent in Studio or via the Live Chat URL to record execution traces, latency, and token consumption metrics.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800/80 bg-neutral-900/40 text-[10px] text-neutral-400 font-mono">
                          <th className="py-2.5 px-4 font-medium">Execution ID</th>
                          <th className="py-2.5 px-4 font-medium">Version</th>
                          <th className="py-2.5 px-4 font-medium">Status</th>
                          <th className="py-2.5 px-4 font-medium">Duration</th>
                          <th className="py-2.5 px-4 font-medium">Tokens</th>
                          <th className="py-2.5 px-4 font-medium text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/50">
                        {recentExecutions.map((exec) => {
                          const isFailed = (exec.status || '').toLowerCase() === 'failed';
                          return (
                            <tr
                              key={exec.id}
                              className="hover:bg-neutral-800/30 transition-colors font-mono text-[11px]"
                            >
                              <td className="py-2.5 px-4 text-neutral-300">
                                {exec.id.slice(0, 18)}...
                              </td>
                              <td className="py-2.5 px-4 text-brand-300 font-semibold">
                                v{exec.workflowVersion || '1.0.0'}
                              </td>
                              <td className="py-2.5 px-4">
                                {isFailed ? (
                                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] bg-red-950 text-red-400 border border-red-800/40">
                                    <AlertTriangle className="size-2.5" />
                                    FAILED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                    <CheckCircle2 className="size-2.5" />
                                    SUCCESS
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-neutral-300">
                                {exec.durationMs < 1000
                                  ? `${exec.durationMs}ms`
                                  : `${(exec.durationMs / 1000).toFixed(2)}s`}
                              </td>
                              <td className="py-2.5 px-4 text-amber-400/90">
                                {exec.totalTokens ? exec.totalTokens.toLocaleString() : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right text-neutral-400 text-[10px]">
                                {new Date(exec.createdAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

