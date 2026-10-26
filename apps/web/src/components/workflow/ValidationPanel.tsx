import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import type { WorkflowValidationResult, ValidationIssue } from '../../types/workflow';

interface ValidationPanelProps {
  validation: WorkflowValidationResult;
  isOpen: boolean;
  onClose: () => void;
  onSelectIssue: (issue: ValidationIssue) => void;
}

export function ValidationPanel({
  validation,
  isOpen,
  onClose,
  onSelectIssue,
}: ValidationPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-5 left-16 z-30 w-96 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-xl text-xs text-neutral-200 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <CheckCircle2 className="size-4 text-emerald-400" />
          ) : (
            <AlertCircle className="size-4 text-amber-400" />
          )}
          <span className="font-semibold text-white">Workflow Graph Integrity</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 font-mono text-[11px]">
        <span
          className={`rounded px-2 py-0.5 border ${
            validation.summary.errors > 0
              ? 'border-red-800/60 bg-red-950/40 text-red-300'
              : 'border-neutral-800 bg-neutral-900 text-neutral-400'
          }`}
        >
          {validation.summary.errors} Errors
        </span>
        <span
          className={`rounded px-2 py-0.5 border ${
            validation.summary.warnings > 0
              ? 'border-amber-800/60 bg-amber-950/40 text-amber-300'
              : 'border-neutral-800 bg-neutral-900 text-neutral-400'
          }`}
        >
          {validation.summary.warnings} Warnings
        </span>
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
        {validation.issues.length === 0 ? (
          <div className="p-3 text-center text-neutral-400 text-xs">
            All nodes, edges, routes, and schemas are valid! Graph is ready for execution.
          </div>
        ) : (
          validation.issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue)}
              className="group rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-2.5 hover:border-brand-500/60 hover:bg-neutral-900 cursor-pointer transition-all space-y-1"
            >
              <div className="flex items-start gap-2">
                {issue.severity === 'error' && (
                  <AlertCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                )}
                {issue.severity === 'warning' && (
                  <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                {issue.severity === 'info' && (
                  <Info className="size-3.5 text-sky-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-neutral-200 group-hover:text-white leading-tight">
                    {issue.message}
                  </div>
                  {issue.suggestion && (
                    <div className="mt-1 text-[11px] text-neutral-400 group-hover:text-neutral-300">
                      💡 {issue.suggestion}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
