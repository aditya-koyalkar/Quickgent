import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FolderPlus,
  Search,
  ArrowRight,
  Workflow,
  MessageSquare,
  Clock,
  Loader2,
  X,
  Plus,
  LogOut,
  Sparkles,
  Bot,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProjects, useCreateProject } from '../hooks/useProjects';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [search, setSearch] = useState('');
  const [page] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const { data: projectsData, isLoading, isError } = useProjects({
    page,
    limit: 20,
    search: search.trim() || undefined,
  });

  const createProjectMutation = useCreateProject();

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const project = await createProjectMutation.mutateAsync({
        name: newProjectName.trim() || 'Untitled Project',
      });
      setIsModalOpen(false);
      setNewProjectName('');
      navigate(`/projects/${project.id}`);
    } catch {
      // error handled by mutation
    }
  };

  const projects = projectsData?.data || [];
  const totalProjects = projectsData?.meta?.total || 0;

  return (
    <div className="min-h-screen bg-neutral-50/60 font-sans text-neutral-900 antialiased">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 no-underline">
              <div className="flex size-7 items-center justify-center rounded-md bg-neutral-900 text-sm font-bold text-white">
                q
              </div>
              <span className="text-lg font-bold tracking-tight text-neutral-900">
                quickgent
              </span>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-800">
                Studio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 text-right">
              <div className="hidden flex-col sm:flex">
                <span className="text-xs font-semibold text-neutral-900">
                  {user?.username || 'User'}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {user?.email}
                </span>
              </div>
              <div className="flex size-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">
                {(user?.username || user?.email || 'U')[0].toUpperCase()}
              </div>
            </div>

            <button
              type="button"
              onClick={() => signOut()}
              title="Sign Out"
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        {/* Header row */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Projects
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Build, test, and deploy intelligent visual AI agent workflows.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-xs transition-all hover:bg-neutral-800"
          >
            <Plus className="size-4" />
            New Project
          </button>
        </div>

        {/* Quick stats strip */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Total Projects
              </span>
              <FolderPlus className="size-4 text-neutral-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-neutral-900">
              {totalProjects}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Visual Workflows
              </span>
              <Workflow className="size-4 text-neutral-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-neutral-900">
              {projects.reduce((acc, p) => acc + (p._count?.workflows || 0), 0)}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                AI Agent Sessions
              </span>
              <Bot className="size-4 text-neutral-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-neutral-900">
              {projects.reduce(
                (acc, p) => acc + (p._count?.conversations || 0),
                0,
              )}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none"
            />
          </div>
        </div>

        {/* ── Project Cards Grid ──────────────────────────────────────── */}
        <div className="mt-6">
          {isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white">
              <div className="flex items-center gap-2.5 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin text-neutral-900" />
                Loading projects…
              </div>
            </div>
          ) : isError ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center">
              <p className="text-sm font-medium text-red-600">
                Failed to load projects. Please try refreshing.
              </p>
            </div>
          ) : projects.length === 0 ? (
            /* Empty state */
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                <Sparkles className="size-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 text-base font-bold text-neutral-900">
                No projects yet
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-neutral-500">
                Get started by creating your first project to design visual AI
                agents, workflows, and prompts.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800"
              >
                <Plus className="size-4" />
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 shadow-2xs transition-all hover:border-neutral-400 hover:shadow-md cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                        <Clock className="size-3" />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-neutral-900 group-hover:text-black">
                      {project.name}
                    </h3>
                  </div>

                  <div className="mt-6 pt-4 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Workflow className="size-3.5 text-neutral-400" />
                          {project._count?.workflows || 0} flows
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-3.5 text-neutral-400" />
                          {project._count?.conversations || 0} chats
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 font-medium text-neutral-900 group-hover:translate-x-0.5 transition-transform">
                        Open Studio
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Create Project Modal ─────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">
                Create new project
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-1.5 text-xs text-neutral-500">
              A project serves as the canvas for your AI agents, workflows, and
              copilot conversations.
            </p>

            <form onSubmit={handleCreateProject} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="project-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-neutral-500"
                >
                  Project name
                </label>
                <input
                  id="project-name"
                  type="text"
                  autoFocus
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Customer Support Concierge"
                  maxLength={150}
                  className="mt-1.5 block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none"
                />
              </div>

              {createProjectMutation.isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
                  {createProjectMutation.error.message}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-60"
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
