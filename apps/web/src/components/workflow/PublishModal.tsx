import { useState, useMemo } from 'react';
import {
  Rocket,
  AlertCircle,
  Copy,
  Check,
  X,
  History,
  Terminal,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react';
import type {
  WorkflowGraph,
  WorkflowValidationResult,
} from '../../types/workflow';
import type { WorkflowItem } from '../../lib/api';

interface PublishModalProps {
  projectId: string;
  graph?: WorkflowGraph;
  validation: WorkflowValidationResult;
  workflows: WorkflowItem[];
  currentVersion: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion: (workflow: WorkflowItem) => void;
  onMakeLive: (version: string) => Promise<void>;
  onPublishNewVersion: (data: {
    version: string;
    note: string;
    makeLiveImmediately: boolean;
  }) => Promise<void>;
}

export function PublishModal({
  projectId,
  graph: _graph,
  validation,
  workflows,
  currentVersion,
  isOpen,
  onClose,
  onSelectVersion,
  onMakeLive,
  onPublishNewVersion,
}: PublishModalProps) {
  const isInitialVersion = workflows.length === 0;

  // Compute smart next version tag suggestion
  const suggestedVersion = useMemo(() => {
    if (isInitialVersion) return '1.0.0';
    if (!currentVersion) return '1.0.0';
    const match = currentVersion.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      const patch = match[3] !== undefined ? parseInt(match[3], 10) : 0;
      return `${major}.${minor}.${patch + 1}`;
    }
    return `${currentVersion}-new`;
  }, [currentVersion, isInitialVersion]);

  const [versionTag, setVersionTag] = useState<string>(suggestedVersion);
  const [note, setNote] = useState<string>(isInitialVersion ? 'Initial workflow release' : '');
  const [makeLiveImmediately, setMakeLiveImmediately] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'publish' | 'history' | 'api'>('publish');

  // Track live version
  const liveWorkflow = workflows.find((w) => w.isLive);

  if (!isOpen) return null;

  const endpointUrl = `${window.location.origin}/api/projects/${projectId}/workflows/live`;

  const handlePublish = async () => {
    if (!validation.isValid) {
      setActionError(
        `Cannot save workflow version: graph has ${validation.summary.errors} validation error(s). All workflow JSON saved to the database must be valid.`,
      );
      return;
    }

    if (!versionTag.trim()) {
      setActionError('Version tag is required.');
      return;
    }

    // Check duplicate
    if (workflows.some((w) => w.version.toLowerCase() === versionTag.trim().toLowerCase())) {
      setActionError(`Version "${versionTag.trim()}" already exists. Please choose a different version tag.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      await onPublishNewVersion({
        version: versionTag.trim(),
        note: note.trim(),
        makeLiveImmediately,
      });
      setActiveTab('history');
    } catch (err: any) {
      setActionError(err.message || 'Failed to publish workflow version');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakeLiveClick = async (version: string) => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onMakeLive(version);
    } catch (err: any) {
      setActionError(err.message || 'Failed to make version LIVE');
    } finally {
      setIsSubmitting(false);
    }
  };

  const curlSnippet = `curl -X POST ${endpointUrl} \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "inputs": {
      "user_message": "Hello agent!"
    }
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl text-xs text-neutral-200 space-y-5">
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/30 text-brand-400">
              <Rocket className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isInitialVersion ? 'Save Initial Workflow Version' : 'Publish Workflow Release'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                {isInitialVersion
                  ? 'Configure your initial version tag, notes, and deployment status.'
                  : 'Manage project versions, create releases, and deploy live.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Tab Switcher ──────────────────────────────────────────────── */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/60 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            className={`flex items-center justify-center gap-1.5 flex-1 rounded-lg py-1.5 font-medium transition-all ${
              activeTab === 'publish'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="size-3.5" />
            {isInitialVersion ? 'Configure Initial Version' : 'Publish as New Version'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center justify-center gap-1.5 flex-1 rounded-lg py-1.5 font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <History className="size-3.5" />
            Version History ({workflows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`flex items-center justify-center gap-1.5 flex-1 rounded-lg py-1.5 font-medium transition-all ${
              activeTab === 'api'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="size-3.5" />
            Live Endpoint
          </button>
        </div>

        {actionError && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-3 flex items-start gap-2.5 text-red-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
            <span className="text-xs">{actionError}</span>
          </div>
        )}

        {/* ── 1. Create Release Tab ─────────────────────────────────────── */}
        {activeTab === 'publish' && (
          <div className="space-y-4">
            {/* Context Badge: Active Editing Base */}
            <div className="flex items-center justify-between rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 text-neutral-400" />
                <span className="text-[11px] text-neutral-400">Current canvas based on:</span>
                <span className="font-mono font-semibold text-brand-300">v{currentVersion || '1.0.0'}</span>
              </div>
              {liveWorkflow && (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live is v{liveWorkflow.version}
                </span>
              )}
            </div>

            {/* Validation Notice / Errors List */}
            {!validation.isValid ? (
              <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-3.5 space-y-2.5 text-red-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-400 shrink-0" />
                  <span className="font-semibold text-white">
                    Cannot Save: {validation.summary.errors} Validation Error{validation.summary.errors > 1 ? 's' : ''} Detected
                  </span>
                </div>
                <p className="text-[11px] text-red-200/90">
                  Every workflow saved to the database must be valid. Please fix the following issue{validation.summary.errors > 1 ? 's' : ''}:
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {validation.issues
                    .filter((issue) => issue.severity === 'error')
                    .map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-lg border border-red-900/60 bg-black/50 p-2 text-[11px] space-y-0.5"
                      >
                        <div className="font-medium text-red-200 flex items-start gap-1.5">
                          <span className="text-red-400 shrink-0">•</span>
                          <span>{issue.message}</span>
                        </div>
                        {issue.suggestion && (
                          <div className="text-[10px] text-neutral-400 pl-3">
                            💡 {issue.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ) : validation.summary.warnings > 0 ? (
              <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 flex items-start gap-2.5 text-amber-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <div className="font-semibold text-white">Advisory Warnings ({validation.summary.warnings})</div>
                  <div className="text-[11px] text-amber-200/90 leading-relaxed">
                    Graph has {validation.summary.warnings} advisory warning(s). Saving and making LIVE is allowed, but reviewing warnings is recommended.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 flex items-center gap-2 text-emerald-300 text-[11px]">
                <Check className="size-3.5 text-emerald-400 shrink-0" />
                <span>Workflow graph is valid and ready to be saved.</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  New Version Tag <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    placeholder="e.g. 1.0.1 or 2.0.0"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
                  />
                  {suggestedVersion !== versionTag && (
                    <button
                      type="button"
                      onClick={() => setVersionTag(suggestedVersion)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-brand-400 hover:text-brand-300 bg-brand-950/60 border border-brand-800/40 px-2 py-0.5 rounded-md"
                    >
                      Use {suggestedVersion}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Version Note / Changelog
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Describe improvements, added nodes, or bug fixes..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Option to automatically make live after creation */}
              <label className="flex items-center gap-2.5 rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-2.5 cursor-pointer hover:bg-neutral-900 transition-colors">
                <input
                  type="checkbox"
                  checked={makeLiveImmediately}
                  onChange={(e) => setMakeLiveImmediately(e.target.checked)}
                  disabled={!validation.canPublish}
                  className="size-4 rounded border-neutral-700 bg-neutral-800 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-neutral-200">
                    Immediately promote to LIVE after saving
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {validation.canPublish
                      ? 'Sets is_live = 1 and activates this version as the project\'s production endpoint.'
                      : 'Requires resolving all graph errors before this version can be promoted to LIVE.'}
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800">
              <div>
                {!validation.isValid ? (
                  <span className="text-[11px] text-red-400 font-medium flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    Fix {validation.summary.errors} error{validation.summary.errors > 1 ? 's' : ''} to save
                  </span>
                ) : !versionTag.trim() ? (
                  <span className="text-[11px] text-amber-400 font-medium">
                    Version tag is required
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !versionTag.trim() || !validation.isValid}
                  onClick={handlePublish}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-500 disabled:opacity-40 shadow-md transition-all cursor-pointer"
                  title={
                    !validation.isValid
                      ? `Cannot save: ${validation.summary.errors} validation error(s) must be fixed.`
                      : !versionTag.trim()
                      ? 'Please enter a valid version tag.'
                      : 'Save workflow version'
                  }
                >
                  <Rocket className="size-3.5" />
                  {isSubmitting
                    ? 'Saving...'
                    : isInitialVersion
                    ? 'Save Initial Version'
                    : 'Publish Version'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. Version History Tab ────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {workflows.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-xs">
                No published workflow versions found in this project.
              </div>
            ) : (
              workflows.map((wf) => {
                const isSelected = wf.version === currentVersion;
                const isLive = wf.isLive;

                return (
                  <div
                    key={wf.id || wf.version}
                    className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                      isSelected
                        ? 'border-brand-500/60 bg-brand-950/20'
                        : isLive
                        ? 'border-emerald-800/40 bg-emerald-950/10'
                        : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs">
                          v{wf.version}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider font-semibold border ${
                            wf.isLive
                              ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {wf.isLive ? 'LIVE' : 'DRAFT'}
                        </span>

                        {isSelected && (
                          <span className="rounded bg-brand-950 border border-brand-800/50 px-1.5 py-0.5 text-[9px] font-mono text-brand-300">
                            OPENED IN STUDIO
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                        <Clock className="size-3" />
                        <span>{new Date(wf.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {wf.note && (
                      <p className="text-[11px] text-neutral-300 leading-relaxed bg-black/40 p-2 rounded-lg border border-neutral-900">
                        {wf.note}
                      </p>
                    )}

                    {/* Version Action Buttons */}
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">
                        Updated {new Date(wf.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-2">
                        {!isSelected && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectVersion(wf);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors"
                          >
                            <ArrowRight className="size-3" />
                            Open in Studio
                          </button>
                        )}

                        {!isLive && (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleMakeLiveClick(wf.version)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                          >
                            <Rocket className="size-3 text-emerald-400" />
                            Make Live
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── 3. Live API Deployment Tab ─────────────────────────────────── */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Project Live Endpoint</span>
                {liveWorkflow ? (
                  <span className="rounded px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px] font-mono">
                    LIVE: v{liveWorkflow.version}
                  </span>
                ) : (
                  <span className="rounded px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/40 text-[10px] font-mono">
                    NO LIVE VERSION YET
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-neutral-300 bg-black/60 p-2.5 rounded-lg break-all border border-neutral-800">
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
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
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
      </div>
    </div>
  );
}
