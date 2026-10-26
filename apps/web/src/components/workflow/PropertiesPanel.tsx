import { useState } from 'react';
import {
  Sliders,
  X,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import type { WorkflowNode, WorkflowGraph } from '../../types/workflow';
import { VariablePicker } from './VariablePicker';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  graph: WorkflowGraph;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

type TabKey = 'general' | 'config' | 'input' | 'output' | 'reliability' | 'test';

export function PropertiesPanel({
  node,
  graph,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('config');
  const [testInput, setTestInput] = useState<string>('{\n  "user_message": "Hello, I need help with my account"\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!node) return null;

  const config = node.data?.config || {};

  const handleUpdateConfig = (key: string, val: any) => {
    onUpdateNode(node.id, {
      data: {
        ...node.data,
        config: {
          ...config,
          [key]: val,
        },
      },
    });
  };

  const handleRunSingleNodeTest = () => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      try {
        const parsed = JSON.parse(testInput);
        setTestResult({
          status: 'success',
          executionTimeMs: 142,
          nodeType: node.type,
          simulatedOutput: {
            success: true,
            node: node.title,
            processedInput: parsed,
            output: `Verified execution output for ${node.type} node`,
          },
        });
      } catch (e: any) {
        setTestResult({
          status: 'error',
          error: e.message || 'Invalid JSON input',
        });
      }
    }, 400);
  };

  return (
    <aside className="w-96 shrink-0 border-l border-neutral-800 bg-neutral-950 flex flex-col z-20 text-xs text-neutral-200">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex h-13 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 items-center justify-center rounded-md bg-neutral-900 border border-neutral-800 shrink-0">
            <Sliders className="size-3.5 text-brand-400" />
          </div>
          <div className="truncate">
            <div className="font-semibold text-white truncate">{node.title}</div>
            <div className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
              {node.type}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Delete this node"
            onClick={() => onDeleteNode(node.id)}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-950/50 hover:text-red-400 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            title="Close inspector"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Contextual Tab Navigation ─────────────────────────────────── */}
      <div className="flex border-b border-neutral-800 bg-neutral-900/40 px-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'config', label: 'Config' },
          { key: 'general', label: 'General' },
          { key: 'input', label: 'Input' },
          { key: 'output', label: 'Output' },
          { key: 'reliability', label: 'Reliability' },
          { key: 'test', label: 'Test' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`px-3 py-2 text-[11px] font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-brand-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content Container ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── 1. CONFIGURATION TAB ─────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {/* START Node Config */}
            {node.type === 'start' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300">Input Schema Parameters</span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = config.inputFields || [];
                      handleUpdateConfig('inputFields', [
                        ...current,
                        {
                          name: `field_${current.length + 1}`,
                          type: 'string',
                          required: true,
                          defaultValue: '',
                          description: '',
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300"
                  >
                    <Plus className="size-3" /> Add Field
                  </button>
                </div>

                <div className="space-y-2">
                  {(config.inputFields || []).map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={f.name}
                          placeholder="field_name"
                          onChange={(e) => {
                            const updated = [...(config.inputFields || [])];
                            updated[idx] = { ...f, name: e.target.value };
                            handleUpdateConfig('inputFields', updated);
                          }}
                          className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px] text-white"
                        />
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const updated = [...(config.inputFields || [])];
                            updated[idx] = { ...f, type: e.target.value };
                            handleUpdateConfig('inputFields', updated);
                          }}
                          className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-300"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="json">json</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = config.inputFields.filter((_: any, i: number) => i !== idx);
                            handleUpdateConfig('inputFields', updated);
                          }}
                          className="text-neutral-500 hover:text-red-400"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <input
                          type="text"
                          placeholder="Default value..."
                          value={f.defaultValue || ''}
                          onChange={(e) => {
                            const updated = [...(config.inputFields || [])];
                            updated[idx] = { ...f, defaultValue: e.target.value };
                            handleUpdateConfig('inputFields', updated);
                          }}
                          className="flex-1 mr-2 rounded border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[11px]"
                        />
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(f.required)}
                            onChange={(e) => {
                              const updated = [...(config.inputFields || [])];
                              updated[idx] = { ...f, required: e.target.checked };
                              handleUpdateConfig('inputFields', updated);
                            }}
                            className="rounded border-neutral-700 accent-brand-500"
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LLM Node Config */}
            {node.type === 'llm' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Provider & Model
                  </label>
                  <select
                    value={config.model || 'gpt-4o-mini'}
                    onChange={(e) => handleUpdateConfig('model', e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="gpt-4o-mini">OpenAI: GPT-4o Mini (Fast)</option>
                    <option value="gpt-4o">OpenAI: GPT-4o (High Intelligence)</option>
                    <option value="claude-3-5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Google: Gemini 1.5 Pro</option>
                    <option value="llama-3.3-70b">Groq: Llama 3.3 70B</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-neutral-400">System Prompt</label>
                  </div>
                  <textarea
                    rows={3}
                    value={config.systemPrompt || ''}
                    onChange={(e) => handleUpdateConfig('systemPrompt', e.target.value)}
                    placeholder="Instructions for the model persona..."
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-neutral-400">User Prompt Template</label>
                    <VariablePicker
                      graph={graph}
                      currentNodeId={node.id}
                      onSelectVariable={(v) => {
                        const current = config.userPrompt || '';
                        handleUpdateConfig('userPrompt', `${current} ${v}`);
                      }}
                    />
                  </div>
                  <textarea
                    rows={4}
                    value={config.userPrompt || ''}
                    onChange={(e) => handleUpdateConfig('userPrompt', e.target.value)}
                    placeholder="e.g. Answer this question: {input.user_message}"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 font-mono text-[11px] text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Temperature ({config.temperature ?? 0.2})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.temperature ?? 0.2}
                      onChange={(e) => handleUpdateConfig('temperature', parseFloat(e.target.value))}
                      className="w-full accent-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Max Output Tokens
                    </label>
                    <input
                      type="number"
                      value={config.maxOutputTokens ?? 1024}
                      onChange={(e) => handleUpdateConfig('maxOutputTokens', parseInt(e.target.value))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Response Format
                  </label>
                  <select
                    value={config.responseFormat || 'text'}
                    onChange={(e) => handleUpdateConfig('responseFormat', e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="text">Standard Text</option>
                    <option value="json_object">Structured JSON Object</option>
                  </select>
                </div>
              </div>
            )}

            {/* AGENT Node Config */}
            {node.type === 'agent' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Agent Intelligence Model
                  </label>
                  <select
                    value={config.model || 'gpt-4o'}
                    onChange={(e) => handleUpdateConfig('model', e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="gpt-4o">OpenAI: GPT-4o (Autonomous reasoning)</option>
                    <option value="claude-3-5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                    <option value="gpt-4o-mini">OpenAI: GPT-4o Mini (Cost efficient)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-neutral-400">Agent Instructions</label>
                    <VariablePicker
                      graph={graph}
                      currentNodeId={node.id}
                      onSelectVariable={(v) => {
                        const current = config.instructions || '';
                        handleUpdateConfig('instructions', `${current} ${v}`);
                      }}
                    />
                  </div>
                  <textarea
                    rows={4}
                    value={config.instructions || ''}
                    onChange={(e) => handleUpdateConfig('instructions', e.target.value)}
                    placeholder="Instructions for the autonomous agent and when to invoke tools..."
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                    Approved Tools
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'web_search', label: 'Live Web Search' },
                      { id: 'knowledge_base', label: 'Vector Knowledge' },
                      { id: 'code_exec', label: 'Python Sandbox' },
                      { id: 'custom_api', label: 'Custom HTTP API' },
                    ].map((tool) => {
                      const selected = (config.availableTools || []).includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => {
                            const cur = config.availableTools || [];
                            const next = selected ? cur.filter((t: string) => t !== tool.id) : [...cur, tool.id];
                            handleUpdateConfig('availableTools', next);
                          }}
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-all flex items-center justify-between ${
                            selected
                              ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                              : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                          }`}
                        >
                          <span>{tool.label}</span>
                          <span className={`size-1.5 rounded-full ${selected ? 'bg-brand-400' : 'bg-neutral-600'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Max Iterations ({config.maxIterations ?? 6})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.maxIterations ?? 6}
                      onChange={(e) => handleUpdateConfig('maxIterations', parseInt(e.target.value))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Budget Cap ($)
                    </label>
                    <input
                      type="number"
                      step={0.05}
                      value={config.budgetLimit ?? 0.25}
                      onChange={(e) => handleUpdateConfig('budgetLimit', parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CONDITION / ROUTER Node Config */}
            {node.type === 'condition' && (
              <div className="space-y-4">
                {/* 1. Dynamic Named Routes Management */}
                <div className="space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-neutral-200">Named Branch Routes</span>
                      <p className="text-[10px] text-neutral-400">
                        Branches mapped in LangGraph path_map & output handles
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = config.routes || [];
                        const newRouteId = `route_${Date.now().toString().slice(-4)}`;
                        const newRoute = {
                          id: newRouteId,
                          label: `Branch ${cur.length + 1}`,
                          description: 'Custom condition path',
                        };
                        handleUpdateConfig('routes', [...cur, newRoute]);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-brand-300 hover:text-white"
                    >
                      <Plus className="size-3" /> Add Branch
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {(config.routes || []).map((route: any, rIdx: number) => {
                      // Check if an edge is already connected from this route handle
                      const connectedEdge = graph.edges.find(
                        (e) => e.source === node.id && (e.sourceHandle === route.id || e.label === route.label),
                      );
                      const targetNode = connectedEdge ? graph.nodes.find((n) => n.id === connectedEdge.target) : null;

                      return (
                        <div
                          key={route.id || rIdx}
                          className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2"
                        >
                          <input
                            type="text"
                            value={route.label}
                            placeholder="Branch Label..."
                            onChange={(e) => {
                              const updated = [...(config.routes || [])];
                              updated[rIdx] = { ...route, label: e.target.value };
                              handleUpdateConfig('routes', updated);
                            }}
                            className="flex-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white focus:border-brand-500 focus:outline-none"
                          />
                          <div className="font-mono text-[10px] text-neutral-400 truncate max-w-28" title={targetNode ? `Target: ${targetNode.title}` : 'Unconnected'}>
                            {targetNode ? `→ ${targetNode.title}` : '(Not connected)'}
                          </div>
                          {(config.routes || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = config.routes.filter((_: any, i: number) => i !== rIdx);
                                handleUpdateConfig('routes', updated);
                              }}
                              className="text-neutral-500 hover:text-red-400"
                              title="Delete route branch"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Routing Rules */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-semibold text-neutral-200">Evaluation Rules</span>
                    <p className="text-[10px] text-neutral-400">Condition checks to route down a branch</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = config.conditions || [];
                      const defaultTarget = config.routes?.[0]?.id || 'route_1';
                      handleUpdateConfig('conditions', [
                        ...cur,
                        {
                          id: `cond_${Date.now()}`,
                          sourceField: 'user_message',
                          operator: 'contains',
                          comparisonValue: '',
                          targetRouteId: defaultTarget,
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300"
                  >
                    <Plus className="size-3" /> Add Rule
                  </button>
                </div>

                <div className="space-y-2">
                  {(config.conditions || []).map((cond: any, idx: number) => (
                    <div
                      key={cond.id || idx}
                      className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-brand-400">Rule #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = config.conditions.filter((_: any, i: number) => i !== idx);
                            handleUpdateConfig('conditions', cur);
                          }}
                          className="text-neutral-500 hover:text-red-400"
                        >
                          <X className="size-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-neutral-400">Evaluate Field</label>
                          <input
                            type="text"
                            list={`fields_list_${node.id}`}
                            value={cond.sourceField || ''}
                            placeholder="e.g. agent_output"
                            onChange={(e) => {
                              const updated = [...(config.conditions || [])];
                              updated[idx] = { ...cond, sourceField: e.target.value };
                              handleUpdateConfig('conditions', updated);
                            }}
                            className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px] text-white"
                          />
                          <datalist id={`fields_list_${node.id}`}>
                            <option value="agent_output" />
                            <option value="user_message" />
                            <option value="llm_output" />
                            <option value="session_id" />
                            <option value="http_response" />
                          </datalist>
                        </div>
                        <div>
                          <label className="text-[10px] text-neutral-400">Operator</label>
                          <select
                            value={cond.operator || 'contains'}
                            onChange={(e) => {
                              const updated = [...(config.conditions || [])];
                              updated[idx] = { ...cond, operator: e.target.value };
                              handleUpdateConfig('conditions', updated);
                            }}
                            className="w-full rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[11px] text-white"
                          >
                            <option value="contains">contains</option>
                            <option value="equals">equals</option>
                            <option value="not_equals">not equals</option>
                            <option value="exists">exists</option>
                            <option value="greater_than">greater than</option>
                            <option value="less_than">less than</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-neutral-400">Comparison Value</label>
                        <input
                          type="text"
                          value={cond.comparisonValue || ''}
                          placeholder="keyword1, keyword2..."
                          onChange={(e) => {
                            const updated = [...(config.conditions || [])];
                            updated[idx] = { ...cond, comparisonValue: e.target.value };
                            handleUpdateConfig('conditions', updated);
                          }}
                          className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px] text-white"
                        />
                      </div>

                      {(() => {
                        const isTargetValid = (config.routes || []).some((r: any) => r.id === cond.targetRouteId);
                        return (
                          <div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-neutral-400">Target Route</span>
                              {!isTargetValid && (
                                <span className="text-red-400 font-bold">⚠️ Route not found in branches</span>
                              )}
                            </div>
                            <select
                              value={cond.targetRouteId || ''}
                              onChange={(e) => {
                                const updated = [...(config.conditions || [])];
                                updated[idx] = { ...cond, targetRouteId: e.target.value };
                                handleUpdateConfig('conditions', updated);
                              }}
                              className={`w-full rounded border px-2 py-1 text-[11px] font-medium ${
                                isTargetValid
                                  ? 'border-neutral-800 bg-neutral-950 text-sky-400'
                                  : 'border-red-500 bg-red-950/40 text-red-300 ring-1 ring-red-500'
                              }`}
                            >
                              {!isTargetValid && (
                                <option value={cond.targetRouteId}>
                                  ⚠️ Invalid: "{cond.targetRouteId}" (Select valid branch below)
                                </option>
                              )}
                              {(config.routes || []).map((r: any) => (
                                <option key={r.id} value={r.id}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Fallback Route (When no rules match)
                  </label>
                  <select
                    value={config.defaultRoute || 'fallback'}
                    onChange={(e) => handleUpdateConfig('defaultRoute', e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="fallback">Default Fallback</option>
                    {(config.routes || []).map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.label} ({r.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* HTTP REQUEST Node Config */}
            {node.type === 'http_request' && (
              <div className="space-y-3.5">
                <div className="flex gap-2">
                  <div className="w-24">
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">Method</label>
                    <select
                      value={config.method || 'POST'}
                      onChange={(e) => handleUpdateConfig('method', e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-white font-semibold"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">Endpoint URL</label>
                    <input
                      type="text"
                      value={config.url || ''}
                      onChange={(e) => handleUpdateConfig('url', e.target.value)}
                      placeholder="https://api.service.com/v1/..."
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 font-mono text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-neutral-400">Request Body (JSON)</label>
                    <VariablePicker
                      graph={graph}
                      currentNodeId={node.id}
                      onSelectVariable={(v) => {
                        const cur = config.bodyMapping || '';
                        handleUpdateConfig('bodyMapping', `${cur} ${v}`);
                      }}
                    />
                  </div>
                  <textarea
                    rows={4}
                    value={config.bodyMapping || ''}
                    onChange={(e) => handleUpdateConfig('bodyMapping', e.target.value)}
                    placeholder="JSON payload mapping..."
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 font-mono text-[11px] text-white"
                  />
                </div>
              </div>
            )}

            {/* TRANSFORM Node Config */}
            {node.type === 'transform' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300">State Variable Assignments</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = config.assignments || [];
                      handleUpdateConfig('assignments', [
                        ...cur,
                        {
                          id: `assign_${Date.now()}`,
                          targetKey: `var_${cur.length + 1}`,
                          sourceMapping: 'user_message',
                          valueType: 'string',
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300"
                  >
                    <Plus className="size-3" /> Add Mapping
                  </button>
                </div>

                {(config.assignments || []).map((assign: any, idx: number) => (
                  <div
                    key={assign.id || idx}
                    className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={assign.targetKey}
                        placeholder="target_variable"
                        onChange={(e) => {
                          const updated = [...(config.assignments || [])];
                          updated[idx] = { ...assign, targetKey: e.target.value };
                          handleUpdateConfig('assignments', updated);
                        }}
                        className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px] text-white"
                      />
                      <ArrowRight className="size-3 text-neutral-500" />
                      <input
                        type="text"
                        value={assign.sourceMapping}
                        placeholder="source_field"
                        onChange={(e) => {
                          const updated = [...(config.assignments || [])];
                          updated[idx] = { ...assign, sourceMapping: e.target.value };
                          handleUpdateConfig('assignments', updated);
                        }}
                        className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px] text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = config.assignments.filter((_: any, i: number) => i !== idx);
                          handleUpdateConfig('assignments', updated);
                        }}
                        className="text-neutral-500 hover:text-red-400"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STRUCTURED OUTPUT Node Config */}
            {node.type === 'structured_output' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-neutral-400">JSON Schema Definition</label>
                  <span className="text-[10px] text-brand-400 font-mono">Draft-07</span>
                </div>
                <textarea
                  rows={8}
                  value={config.outputSchema || ''}
                  onChange={(e) => handleUpdateConfig('outputSchema', e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 font-mono text-[11px] text-white"
                />
              </div>
            )}

            {/* END Node Config */}
            {node.type === 'end' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Terminal Response Format
                  </label>
                  <select
                    value={config.responseFormat || 'json'}
                    onChange={(e) => handleUpdateConfig('responseFormat', e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="json">Structured JSON Response</option>
                    <option value="text">Formatted Text Message</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-neutral-300">
                    <input
                      type="checkbox"
                      checked={Boolean(config.includeExecutionId ?? true)}
                      onChange={(e) => handleUpdateConfig('includeExecutionId', e.target.checked)}
                      className="accent-brand-500"
                    />
                    <span>Include execution ID in response payload</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-neutral-300">
                    <input
                      type="checkbox"
                      checked={Boolean(config.includeMetadata ?? true)}
                      onChange={(e) => handleUpdateConfig('includeMetadata', e.target.checked)}
                      className="accent-brand-500"
                    />
                    <span>Include execution metadata (tokens & latency)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. GENERAL TAB ───────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">Node Title</label>
              <input
                type="text"
                value={node.title}
                onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">Description</label>
              <textarea
                rows={3}
                value={node.data?.description || ''}
                onChange={(e) =>
                  onUpdateNode(node.id, {
                    data: { ...node.data, description: e.target.value },
                  })
                }
                placeholder="Describe this node's responsibility..."
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                Output State Variable
              </label>
              <input
                type="text"
                value={node.data?.outputVar || ''}
                onChange={(e) =>
                  onUpdateNode(node.id, {
                    data: { ...node.data, outputVar: e.target.value },
                  })
                }
                placeholder="e.g. agent_solution"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 font-mono text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ── 3. INPUT TAB ─────────────────────────────────────────────── */}
        {activeTab === 'input' && (
          <div className="space-y-3.5">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <span className="text-[11px] font-semibold text-neutral-300">Variable Resolver</span>
              <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                Use curly braces to map upstream state variables into node inputs.
              </p>
              <div className="mt-2.5">
                <VariablePicker
                  graph={graph}
                  currentNodeId={node.id}
                  onSelectVariable={(v) => {
                    if (node.type === 'llm') {
                      handleUpdateConfig('userPrompt', `${config.userPrompt || ''} ${v}`);
                    } else if (node.type === 'agent') {
                      handleUpdateConfig('instructions', `${config.instructions || ''} ${v}`);
                    }
                  }}
                  buttonLabel="Pick & Insert Variable"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 4. OUTPUT TAB ────────────────────────────────────────────── */}
        {activeTab === 'output' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <span className="text-[11px] font-semibold text-neutral-300">Produced State Keys</span>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-brand-300">
                <div>• state.{node.data?.outputVar || `${node.type}_output`}</div>
                {node.type === 'condition' && <div>• state.condition_route</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── 5. RELIABILITY TAB ───────────────────────────────────────── */}
        {activeTab === 'reliability' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                Execution Timeout (ms)
              </label>
              <input
                type="number"
                value={config.timeoutMs || 30000}
                onChange={(e) => handleUpdateConfig('timeoutMs', parseInt(e.target.value))}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                Max Retries
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={config.retryPolicy?.maxRetries ?? 2}
                onChange={(e) =>
                  handleUpdateConfig('retryPolicy', {
                    ...(config.retryPolicy || {}),
                    maxRetries: parseInt(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* ── 6. TEST TAB ──────────────────────────────────────────────── */}
        {activeTab === 'test' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                Sample Test Input (JSON)
              </label>
              <textarea
                rows={4}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 font-mono text-[11px] text-white"
              />
            </div>

            <button
              type="button"
              disabled={isTesting}
              onClick={handleRunSingleNodeTest}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {isTesting ? (
                <>
                  <RotateCcw className="size-3 animate-spin" />
                  Testing Node...
                </>
              ) : (
                <>
                  <Play className="size-3" />
                  Run Isolated Node Test
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`rounded-lg border p-3 font-mono text-[11px] space-y-1.5 ${
                  testResult.status === 'success'
                    ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
                    : 'border-red-800/60 bg-red-950/30 text-red-300'
                }`}
              >
                <div className="font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>{testResult.status}</span>
                  {testResult.executionTimeMs && <span>{testResult.executionTimeMs}ms</span>}
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-[10px]">
                  {JSON.stringify(testResult.simulatedOutput || testResult.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
