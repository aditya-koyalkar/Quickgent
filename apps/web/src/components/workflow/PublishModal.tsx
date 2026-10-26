import { useState } from 'react';
import {
  Rocket,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  History,
  Terminal,
} from 'lucide-react';
import type {
  WorkflowGraph,
  WorkflowValidationResult,
  PublishedVersion,
} from '../../types/workflow';
import { serializeToCanonical } from '../../lib/workflow/canonical';

interface PublishModalProps {
  graph: WorkflowGraph;
  validation: WorkflowValidationResult;
  publishedVersions: PublishedVersion[];
  isOpen: boolean;
  onClose: () => void;
  onPublishVersion: (version: PublishedVersion) => void;
  onRollbackVersion: (version: PublishedVersion) => void;
}

export function PublishModal({
  graph,
  validation,
  publishedVersions,
  isOpen,
  onClose,
  onPublishVersion,
  onRollbackVersion,
}: PublishModalProps) {
  const [versionTag, setVersionTag] = useState<string>('1.0.0');
  const [changelog, setChangelog] = useState<string>('Initial production release');
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'publish' | 'history' | 'api'>('publish');

  if (!isOpen) return null;

  const endpointUrl = `https://api.quickgent.ai/v1/agents/${graph.id || 'default'}/execute`;

  const handlePublish = () => {
    if (!validation.canPublish) return;

    const newPublished: PublishedVersion = {
      version: versionTag.trim() || '1.0.0',
      publishedAt: new Date().toISOString(),
      changelog: changelog.trim(),
      workflowSnapshot: serializeToCanonical(graph),
      deploymentUrl: endpointUrl,
      apiKeyPrefix: 'qg_live_',
      isCurrentLive: true,
    };

    onPublishVersion(newPublished);
    setActiveTab('api');
  };

  const curlSnippet = `curl -X POST ${endpointUrl} \\
  -H "Authorization: Bearer qg_live_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "inputs": {
      "user_message": "Need urgent technical help"
    }
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl text-xs text-neutral-200 space-y-5">
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-600/10 border border-brand-500/30 text-brand-400">
              <Rocket className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Publish Workflow to Production</h2>
              <p className="text-[11px] text-neutral-400">
                Create immutable release versions and obtain deployment API endpoints.
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

        {/* ── Tab Switcher ──────────────────────────────────────────────── */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/50 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            className={`flex-1 rounded-lg py-1.5 font-medium transition-all ${
              activeTab === 'publish'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Create Release
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`flex-1 rounded-lg py-1.5 font-medium transition-all ${
              activeTab === 'api'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            API Deployment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 rounded-lg py-1.5 font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Version History ({publishedVersions.length})
          </button>
        </div>

        {/* ── 1. Create Release Tab ─────────────────────────────────────── */}
        {activeTab === 'publish' && (
          <div className="space-y-4">
            {/* Validation Pre-requisite Notice */}
            {!validation.canPublish ? (
              <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 flex items-start gap-2.5 text-amber-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <div className="font-semibold text-white">Validation Issues Detected</div>
                  <div className="text-[11px] text-amber-200/90 leading-relaxed">
                    Workflows can only be published when all errors are resolved. Please review the{' '}
                    <strong>{validation.summary.errors} errors</strong> and{' '}
                    <strong>{validation.summary.warnings} warnings</strong> before publishing.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3 flex items-center gap-2.5 text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>Workflow validation passed! Graph is ready for immutable release.</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Release Version Tag
                </label>
                <input
                  type="text"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value)}
                  placeholder="e.g. 1.0.1"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Release Notes / Changelog
                </label>
                <textarea
                  rows={3}
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="Describe improvements or changes made in this release..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 font-medium text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!validation.canPublish}
                onClick={handlePublish}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-500 disabled:opacity-40 shadow-md transition-all"
              >
                <Rocket className="size-3.5" />
                Publish Version
              </button>
            </div>
          </div>
        )}

        {/* ── 2. API Deployment Tab ─────────────────────────────────────── */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Live Execution Endpoint</span>
                <span className="rounded px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px] font-mono">
                  ACTIVE
                </span>
              </div>
              <div className="font-mono text-[11px] text-neutral-300 bg-black/60 p-2 rounded-lg break-all">
                {endpointUrl}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                  <Terminal className="size-3.5 text-brand-400" />
                  <span>cURL Integration Snippet</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(curlSnippet);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
                >
                  {isCopied ? (
                    <>
                      <Check className="size-3 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy cURL
                    </>
                  )}
                </button>
              </div>

              <pre className="max-h-48 overflow-x-auto rounded-xl border border-neutral-800 bg-black/80 p-3 font-mono text-[11px] text-neutral-300 leading-relaxed">
                {curlSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* ── 3. Version History Tab ────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {publishedVersions.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 text-xs">
                No versions have been published yet.
              </div>
            ) : (
              publishedVersions.map((v) => (
                <div
                  key={v.version}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-xs">v{v.version}</span>
                      {v.isCurrentLive && (
                        <span className="rounded bg-brand-950 border border-brand-800/50 px-1.5 py-0.5 text-[9px] font-mono text-brand-300">
                          CURRENT LIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(v.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {v.changelog && (
                    <p className="text-[11px] text-neutral-300 leading-relaxed">{v.changelog}</p>
                  )}

                  {!v.isCurrentLive && (
                    <div className="pt-2 border-t border-neutral-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onRollbackVersion(v)}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-[11px] text-neutral-200 hover:text-white"
                      >
                        <History className="size-3" />
                        Rollback to this version
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
