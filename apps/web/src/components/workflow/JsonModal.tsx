import { useState } from 'react';
import { Code2, Copy, Check, Download, Upload, X, AlertCircle } from 'lucide-react';
import type { WorkflowGraph, CanonicalWorkflow } from '../../types/workflow';
import {
  serializeToCanonical,
  deserializeFromCanonical,
  parseAndValidateWorkflowJson,
} from '../../lib/workflow/canonical';

interface JsonModalProps {
  graph: WorkflowGraph;
  isOpen: boolean;
  onClose: () => void;
  onImportGraph: (imported: WorkflowGraph) => void;
}

export function JsonModal({ graph, isOpen, onClose, onImportGraph }: JsonModalProps) {
  const [activeTab, setActiveTab] = useState<'canonical' | 'import'>('canonical');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const canonical: CanonicalWorkflow = serializeToCanonical(graph);
  const jsonString = JSON.stringify(canonical, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.name.toLowerCase().replace(/\s+/g, '_')}_v${graph.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setImportError(null);
    if (!importText.trim()) return;

    try {
      const parsedCanonical = parseAndValidateWorkflowJson(importText.trim());
      const deserialized = deserializeFromCanonical(parsedCanonical);
      onImportGraph(deserialized);
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Invalid workflow specification.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex h-[82vh] w-full max-w-3xl flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl text-xs text-neutral-200 space-y-4">
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400">
              <Code2 className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Canonical Workflow JSON</h2>
              <p className="text-[11px] text-neutral-400">
                Language-neutral schemaVersion 1.0.0 representation for runtime compilation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Tabs & Actions Bar ───────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('canonical')}
              className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                activeTab === 'canonical'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                activeTab === 'import'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Import JSON
            </button>
          </div>

          {activeTab === 'canonical' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 font-medium text-neutral-300 hover:text-white transition-colors"
              >
                {isCopied ? (
                  <>
                    <Check className="size-3 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3" /> Copy JSON
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 font-medium text-neutral-300 hover:text-white transition-colors"
              >
                <Download className="size-3" /> Download .json
              </button>
            </div>
          )}
        </div>

        {/* ── Tab Views ────────────────────────────────────────────────── */}
        {activeTab === 'canonical' ? (
          <div className="flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-black/80">
            <pre className="h-full overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-neutral-300 select-text">
              {jsonString}
            </pre>
          </div>
        ) : (
          <div className="flex flex-1 flex-col space-y-3">
            {importError && (
              <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-3 flex items-start gap-2 text-red-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
                <span className="text-[11px] leading-relaxed">{importError}</span>
              </div>
            )}

            <textarea
              rows={12}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder="Paste Canonical Workflow JSON here..."
              className="flex-1 w-full rounded-xl border border-neutral-800 bg-black/80 p-3 font-mono text-[11px] text-white focus:border-brand-500 focus:outline-none resize-none"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 font-medium text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importText.trim()}
                onClick={handleImport}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-500 disabled:opacity-40 shadow-md"
              >
                <Upload className="size-3.5" /> Import & Render
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
