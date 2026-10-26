import { useState, useRef, useEffect } from 'react';
import { Variable, ChevronDown, Check } from 'lucide-react';
import type { WorkflowGraph } from '../../types/workflow';

interface VariablePickerProps {
  graph: WorkflowGraph;
  currentNodeId?: string;
  onSelectVariable: (variableTemplate: string) => void;
  className?: string;
  buttonLabel?: string;
}

export function VariablePicker({
  graph,
  currentNodeId,
  onSelectVariable,
  className = '',
  buttonLabel = 'Insert Variable',
}: VariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Aggregate available variables from Start node inputs and other upstream nodes
  const availableVars: Array<{ key: string; source: string; description?: string }> = [];

  const startNode = graph.nodes.find((n) => n.type === 'start');
  if (startNode?.data?.config?.inputFields) {
    startNode.data.config.inputFields.forEach((f: any) => {
      availableVars.push({
        key: `{input.${f.name}}`,
        source: 'Start Input',
        description: f.description || `Type: ${f.type}`,
      });
    });
  } else {
    availableVars.push(
      { key: '{input.user_message}', source: 'Start Input', description: 'Customer query' },
      { key: '{input.session_id}', source: 'Start Input', description: 'Session UUID' },
    );
  }

  // Add state variables from other nodes
  graph.nodes.forEach((n) => {
    if (n.id !== currentNodeId) {
      if (n.type === 'llm') {
        availableVars.push({
          key: `{state.${n.data?.outputVar || 'llm_output'}}`,
          source: n.title,
          description: 'LLM generated completion',
        });
      } else if (n.type === 'agent') {
        availableVars.push({
          key: `{state.${n.data?.outputVar || 'agent_output'}}`,
          source: n.title,
          description: 'Agent final resolution',
        });
      } else if (n.type === 'condition') {
        availableVars.push({
          key: '{state.condition_route}',
          source: n.title,
          description: 'Selected routing branch ID',
        });
      } else if (n.type === 'http_request') {
        const key = n.data?.config?.responseMapping?.targetStateKey || 'http_response';
        availableVars.push({
          key: `{state.${key}}`,
          source: n.title,
          description: 'API response data',
        });
      } else if (n.type === 'transform') {
        const key = n.data?.config?.outputMapping || 'transformed_data';
        availableVars.push({
          key: `{state.${key}}`,
          source: n.title,
          description: 'Mapped transformed data',
        });
      }
    }
  });

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:border-brand-500 hover:text-white transition-colors"
        title="Insert a workflow state variable"
      >
        <Variable className="size-3 text-brand-400" />
        <span>{buttonLabel}</span>
        <ChevronDown className="size-3 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-neutral-800 bg-neutral-950 p-1.5 shadow-2xl z-50 text-xs backdrop-blur-md">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800/80 mb-1">
            Available Workflow Variables
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {availableVars.length === 0 ? (
              <div className="p-2 text-center text-neutral-400 text-[11px]">
                No variables available yet.
              </div>
            ) : (
              availableVars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    onSelectVariable(v.key);
                    setIsOpen(false);
                  }}
                  className="w-full text-left rounded-lg p-1.5 hover:bg-neutral-900 group transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-brand-300 group-hover:text-brand-200 truncate">
                      {v.key}
                    </div>
                    <div className="text-[10px] text-neutral-400 flex items-center gap-1 truncate">
                      <span className="text-neutral-300">{v.source}</span>
                      {v.description && <span>· {v.description}</span>}
                    </div>
                  </div>
                  <Check className="size-3 text-emerald-400 opacity-0 group-hover:opacity-100 shrink-0 ml-1.5" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
