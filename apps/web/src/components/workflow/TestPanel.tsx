import { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  ChevronDown,
  ChevronRight,
  X,
  History,
} from 'lucide-react';
import type { WorkflowGraph, WorkflowExecutionTrace } from '../../types/workflow';
import { executeWorkflow } from '../../lib/workflow/runtime';

interface TestPanelProps {
  graph: WorkflowGraph;
  isOpen: boolean;
  onClose: () => void;
  onNodeHighlight?: (nodeId: string | null) => void;
}

export function TestPanel({ graph, isOpen, onClose, onNodeHighlight }: TestPanelProps) {
  const [inputJson, setInputJson] = useState<string>(
    JSON.stringify(
      {
        user_message: 'How do I upgrade my subscription plan to Enterprise?',
        session_id: 'sess_live_test_01',
      },
      null,
      2,
    ),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [activeExecution, setActiveExecution] = useState<WorkflowExecutionTrace | null>(null);
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecutionTrace[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleExpandNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleRunExecution = async () => {
    setIsRunning(true);
    setActiveExecution(null);

    let parsedInputs: Record<string, any>;
    try {
      parsedInputs = JSON.parse(inputJson);
    } catch {
      parsedInputs = { user_message: inputJson };
    }

    try {
      const trace = await executeWorkflow(graph, {
        inputs: parsedInputs,
        onNodeStart: (id) => onNodeHighlight?.(id),
        onNodeFinish: () => onNodeHighlight?.(null),
        mockDelayMs: 300,
      });

      setActiveExecution(trace);
      setExecutionHistory((prev) => [trace, ...prev.slice(0, 9)]);
    } catch (err: any) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setIsRunning(false);
      onNodeHighlight?.(null);
    }
  };

  return (
    <aside className="w-[420px] shrink-0 border-l border-neutral-800 bg-neutral-950 flex flex-col z-20 text-xs text-neutral-200">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex h-13 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-brand-500/10 border border-brand-500/30 text-brand-400">
            <Play className="size-3.5 fill-brand-400" />
          </div>
          <div>
            <div className="font-semibold text-white">Workflow Test Runner</div>
            <div className="font-mono text-[10px] text-neutral-400">
              Interactive Execution Tracing
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── Input Payload Editor ──────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-neutral-300">
              Sample Workflow Input (JSON)
            </label>
            <button
              type="button"
              onClick={() => {
                const start = graph.nodes.find((n) => n.type === 'start');
                const sample: Record<string, any> = {};
                start?.data?.config?.inputFields?.forEach((f: any) => {
                  sample[f.name] = f.defaultValue || `sample_${f.name}`;
                });
                setInputJson(JSON.stringify(sample, null, 2));
              }}
              className="text-[10px] text-brand-400 hover:text-brand-300 font-mono"
            >
              Reset from Schema
            </button>
          </div>

          <textarea
            rows={5}
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 font-mono text-[11px] text-white focus:border-brand-500 focus:outline-none"
          />

          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunExecution}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-500 shadow-md transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCcw className="size-3.5 animate-spin" />
                Executing Graph Nodes...
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-white" />
                Run Complete Workflow Test
              </>
            )}
          </button>
        </div>

        {/* ── Active Execution Results & Trace ──────────────────────────── */}
        {activeExecution && (
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">Execution Trace</span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase font-semibold ${
                  activeExecution.status === 'completed'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                    : 'bg-red-950 text-red-300 border border-red-800/40'
                }`}
              >
                {activeExecution.status}
              </span>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 flex items-center gap-1.5">
                <Clock className="size-3 text-neutral-400" />
                <span className="text-neutral-400">Duration:</span>
                <span className="text-white font-semibold">{activeExecution.totalDurationMs}ms</span>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 flex items-center gap-1.5">
                <Coins className="size-3 text-neutral-400" />
                <span className="text-neutral-400">Tokens:</span>
                <span className="text-white font-semibold">{activeExecution.totalTokens}</span>
              </div>
            </div>

            {/* Step-by-Step Node Traces */}
            <div className="space-y-1.5">
              {activeExecution.stepTraces.map((step, idx) => {
                const isExpanded = expandedNodes[step.nodeId];
                return (
                  <div
                    key={step.nodeId || idx}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden"
                  >
                    <div
                      onClick={() => toggleExpandNode(step.nodeId)}
                      className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-neutral-900 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {step.status === 'success' ? (
                          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="size-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="font-semibold text-white truncate">{step.nodeName}</span>
                        <span className="font-mono text-[9px] uppercase text-neutral-400">
                          {step.nodeType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-neutral-400">
                          {step.durationMs}ms
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="size-3.5 text-neutral-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 border-t border-neutral-800/80 bg-neutral-950 font-mono text-[10px] space-y-2">
                        {step.selectedRoute && (
                          <div className="text-sky-300">
                            <strong>Selected Branch:</strong> {step.selectedRoute}
                          </div>
                        )}

                        {step.toolCalls && step.toolCalls.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                              Tool Invocations ({step.toolCalls.length}):
                            </span>
                            {step.toolCalls.map((tc) => (
                              <div
                                key={tc.id}
                                className="rounded border border-neutral-800 bg-neutral-900 p-1.5 text-neutral-300"
                              >
                                <span className="text-brand-300 font-bold">{tc.toolName}</span> (
                                {tc.durationMs}ms)
                                <div className="text-neutral-400 truncate">
                                  {JSON.stringify(tc.result)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                            Output:
                          </span>
                          <pre className="mt-1 max-h-32 overflow-x-auto whitespace-pre-wrap text-neutral-300">
                            {JSON.stringify(step.outputData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Final Workflow Response Output */}
            {activeExecution.outputs && (
              <div className="rounded-xl border border-brand-500/30 bg-brand-950/20 p-3 space-y-1.5">
                <span className="font-semibold text-brand-300">Final Returned Response</span>
                <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-white">
                  {JSON.stringify(activeExecution.outputs, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Execution History ─────────────────────────────────────────── */}
        {executionHistory.length > 1 && (
          <div className="pt-3 border-t border-neutral-800 space-y-2">
            <div className="flex items-center gap-1.5 text-neutral-400 font-medium text-[11px]">
              <History className="size-3" />
              <span>Prior Test Runs ({executionHistory.length})</span>
            </div>
            <div className="space-y-1">
              {executionHistory.slice(1, 5).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setActiveExecution(h)}
                  className="w-full flex items-center justify-between rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-2 text-left hover:border-neutral-700 hover:bg-neutral-900 transition-colors"
                >
                  <span className="font-mono text-[10px] text-neutral-300">{h.id}</span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {h.totalDurationMs}ms · {h.totalTokens} tokens
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
