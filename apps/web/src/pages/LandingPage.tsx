import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus } from 'lucide-react';

// ── Navbar ──────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex size-7 items-center justify-center rounded-md bg-neutral-900 text-sm font-bold text-white">
            q
          </div>
          <span className="text-xl font-bold tracking-tight text-neutral-900">
            quickgent
          </span>
        </Link>



        {/* Action buttons */}
        <div className="flex items-center gap-4">
          <Link
            to="/signin"
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 no-underline transition-colors hover:text-neutral-900"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline transition-all hover:bg-neutral-800"
          >
            Start building
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero Section ────────────────────────────────────────────────────
function Hero() {
  const [zoom, setZoom] = useState(100);

  return (
    <section className="relative overflow-hidden bg-white pt-10 pb-14 lg:pt-14 lg:pb-18">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-6">
            {/* Pill tag */}
            <div className="inline-block rounded bg-neutral-100 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-neutral-500">
              Visual AI agent builder
            </div>

            {/* Headline */}
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-neutral-900 sm:text-5xl lg:text-[3.5rem]">
              Build and scale AI agents in minutes, not months.
            </h1>

            {/* Subheading */}
            <p className="mt-5 text-lg font-medium text-neutral-900 sm:text-xl">
              You design the logic. Quickgent handles the orchestration.
            </p>

            {/* Supporting copy */}
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-neutral-500 sm:text-base">
              Create, connect, and deploy intelligent AI agents with a visual workflow
              builder and natural-language control.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white no-underline transition-all hover:bg-neutral-800"
              >
                Build your first agent
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-800 transition-all hover:border-neutral-300 hover:bg-neutral-50"
              >
                Watch a 3-min demo
              </button>
            </div>

            {/* Microcopy */}
            <p className="mt-6 text-xs text-neutral-400">
              Free to start · No credit card · Your first agent in minutes
            </p>
          </div>

          {/* Right Column: Visual Workflow Mockup */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200/60">
                <span className="text-xs font-semibold text-neutral-800">
                  Customer support / Support concierge
                </span>
                <span className="rounded bg-neutral-200/70 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                  Visual workflow
                </span>
              </div>

              {/* Canvas diagram */}
              <div className="relative py-6">
                {/* Node 1: Start */}
                <div className="mx-auto max-w-[240px] rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    01 / Start
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-neutral-900">
                    Receive message
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-neutral-400">
                    message · conversation_id
                  </div>
                </div>

                {/* Connecting Line 1 -> 2 */}
                <div className="mx-auto h-6 w-px bg-neutral-300" />

                {/* Node 2: LLM Response (Highlighted) */}
                <div className="mx-auto max-w-[240px] rounded-xl border-2 border-neutral-900 bg-white p-3.5 shadow-xs">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    02 / LLM Response
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-neutral-900">
                    Answer with knowledge
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-neutral-400">
                    GPT-4.1 mini · temp 0.3
                  </div>
                </div>

                {/* Connecting Line 2 -> 3 */}
                <div className="mx-auto h-6 w-px bg-neutral-300" />

                {/* Node 3: Condition */}
                <div className="mx-auto max-w-[240px] rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    03 / Condition
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-neutral-900">
                    Confidence check
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-neutral-400">
                    confidence ≥ 0.80
                  </div>
                </div>

                {/* Branching fork lines */}
                <div className="mx-auto h-4 w-px bg-neutral-300" />
                <div className="relative mx-auto w-[280px]">
                  {/* Horizontal bar */}
                  <div className="h-px w-full bg-neutral-300" />
                  {/* Left and Right drops */}
                  <div className="absolute left-0 top-0 h-4 w-px bg-neutral-300" />
                  <div className="absolute right-0 top-0 h-4 w-px bg-neutral-300" />
                </div>

                {/* Branch labels */}
                <div className="mx-auto mt-1 flex w-[320px] justify-between text-[10px] font-mono text-neutral-400">
                  <span className="pl-4">TRUE · confident</span>
                  <span className="pr-4">FALSE · needs help</span>
                </div>

                {/* Split Nodes */}
                <div className="mt-2 grid grid-cols-2 gap-4">
                  {/* Node 4: End confident */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      04 / End
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-neutral-900">
                      Return answer
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-neutral-400">
                      response = answer
                    </div>
                  </div>

                  {/* Node 5: End human handoff */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      05 / End
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-neutral-900">
                      Human handoff
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-neutral-400">
                      response = handoff_message
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Canvas Toolbar */}
              <div className="mt-3 flex items-center justify-between border-t border-neutral-200/60 pt-3 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(50, z - 10))}
                    className="hover:text-neutral-700"
                    aria-label="Zoom out"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="font-mono text-[11px]">{zoom}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(150, z + 10))}
                    className="hover:text-neutral-700"
                    aria-label="Zoom in"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="font-mono text-[11px] text-neutral-400 hover:text-neutral-700"
                >
                  Fit to view
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section 01: Build the experience, not the infrastructure ─────────
function Section01() {
  const cards = [
    {
      num: '01',
      title: 'Make logic visible',
      desc: 'Connect prompts, decisions, and outcomes in one readable workflow. No hidden chains to untangle.',
      footer: 'Start → Respond → Decide → Finish',
    },
    {
      num: '02',
      title: 'Know why it worked',
      desc: 'Follow every node, inspect model outputs, and reproduce failures before your users find them.',
      footer: 'Inputs, outputs, timing, and errors',
    },
    {
      num: '03',
      title: 'Ship with confidence',
      desc: "Publish a tested version to a hosted URL. Keep improving your draft without changing what's live.",
      footer: 'Immutable versions · Controlled releases',
    },
  ];

  return (
    <section className="border-b border-neutral-200/80 bg-white py-14 lg:py-18">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        {/* Section Header */}
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-neutral-400">
          01 / Less plumbing. More product.
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.5rem]">
          Build the experience, not the infrastructure.
        </h2>
        <p className="mt-2 text-base text-neutral-500 sm:text-lg">
          Move from stitched-together scripts to a workflow your whole team can understand.
        </p>

        {/* 3 Cards */}
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.num}
              className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 shadow-xs transition-all hover:border-neutral-300"
            >
              <div>
                <span className="inline-block rounded bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-600">
                  {card.num}
                </span>
                <h3 className="mt-4 text-lg font-bold text-neutral-900">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  {card.desc}
                </p>
              </div>

              <div>
                <div className="my-5 h-px bg-neutral-100" />
                <p className="text-xs font-mono text-neutral-500">
                  {card.footer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section 02: The Workflow ─────────────────────────────────────────
function Section02() {
  const steps = [
    {
      step: '1 / CREATE',
      title: 'Describe the job',
      desc: "Create a project, choose your model, and write your agent's instructions.",
    },
    {
      step: '2 / CONNECT',
      title: 'Design the decisions',
      desc: 'Add nodes and branches. Ask the copilot to propose changes, then review them.',
    },
    {
      step: '3 / TEST',
      title: 'Follow the execution',
      desc: 'Chat with your draft and inspect every step, including timing and failures.',
    },
    {
      step: '4 / DEPLOY',
      title: 'Share a live agent',
      desc: 'Validate your graph, publish an immutable version, and share its hosted URL.',
    },
  ];

  return (
    <section className="border-b border-neutral-200/80 bg-white py-14 lg:py-18">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        {/* Section Header */}
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-neutral-400">
          02 / The workflow
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.5rem]">
          A shorter path from prompt to production.
        </h2>
        <p className="mt-2 text-base text-neutral-500 sm:text-lg">
          Start from a blank canvas or describe your agent to the AI copilot.
        </p>

        {/* 4 Workflow Steps */}
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.step} className="space-y-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                {s.step}
              </span>
              <h3 className="text-base font-bold text-neutral-900">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section 03: Questions / FAQ ──────────────────────────────────────
function Section03() {
  const faqs = [
    {
      q: 'Do I need to write code?',
      a: 'No. Build the workflow visually, set instructions, and connect decisions. Quickgent runs the orchestration for you.',
    },
    {
      q: 'Can I test before I publish?',
      a: "Yes. Test your draft in a private chat and inspect each node's inputs, outputs, timing, and errors.",
    },
    {
      q: 'Will editing a draft affect my live agent?',
      a: 'No. Your hosted agent uses an immutable published version. Draft changes stay private until you publish.',
    },
    {
      q: 'Can I switch back to an earlier version?',
      a: 'Yes. Review an earlier publication and roll back the active deployment. Your current draft stays unchanged.',
    },
  ];

  return (
    <section className="bg-white py-14 lg:py-18">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column */}
          <div className="lg:col-span-4">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-neutral-400">
              03 / A few good questions
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Before you build.
            </h2>
            <p className="mt-4 text-sm text-neutral-500">
              Have a more specific question? Reach us at{' '}
              <a
                href="mailto:hello@quickgent.ai"
                className="text-neutral-900 underline hover:text-neutral-600"
              >
                hello@quickgent.ai
              </a>
              .
            </p>
          </div>

          {/* Right Column: Q&A list */}
          <div className="space-y-6 lg:col-span-8">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border-b border-neutral-200/70 pb-6 last:border-b-0"
              >
                <h3 className="text-base font-semibold text-neutral-900">
                  {faq.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-neutral-200/80 bg-neutral-50/50 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row lg:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded bg-neutral-900 text-xs font-bold text-white">
            q
          </div>
          <span className="text-sm font-bold text-neutral-900">quickgent</span>
        </div>
        <p className="text-xs text-neutral-400">
          © {new Date().getFullYear()} Quickgent · Visual AI Agent Builder. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ── Main Page Component ─────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white">
      <Navbar />
      <Hero />
      <Section01 />
      <Section02 />
      <Section03 />
      <Footer />
    </div>
  );
}
