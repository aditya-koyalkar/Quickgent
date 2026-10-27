import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SignInPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    try {
      await signIn(emailOrUsername, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ── */}
      <div className="hidden w-1/2 flex-col justify-between bg-neutral-50 p-12 lg:flex xl:p-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex size-7 items-center justify-center rounded-md bg-neutral-900 text-sm font-bold text-white">
            q
          </div>
          <span className="text-base font-bold tracking-tight text-neutral-900">
            quickgent
          </span>
        </Link>

        {/* Hero copy */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            From idea to agent
          </p>
          <h2 className="mt-5 text-[2.5rem] font-bold leading-[1.15] tracking-tight text-neutral-900 xl:text-[2.75rem]">
            A clear path from your first prompt to your first deployment.
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-neutral-500">
            Design the logic. See every step. Ship an agent you understand.
          </p>

          {/* Steps */}
          <div className="mt-14 space-y-10">
            {[
              { num: '01', title: 'Create a project', desc: 'A home for your agents and workflows.' },
              { num: '02', title: 'Build and test', desc: 'Connect nodes and inspect every execution.' },
              { num: '03', title: 'Publish with confidence', desc: 'A versioned agent, ready to share.' },
            ].map((step, i) => (
              <div key={i}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-neutral-400">{step.num}</span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-neutral-900">{step.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-400">
          Quickgent / Visual AI Agent Builder
        </p>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex w-full flex-col bg-white lg:w-1/2">
        {/* Top nav */}
        <div className="flex items-center justify-between px-8 pt-8 lg:justify-end">
          <Link to="/" className="flex items-center gap-2 lg:hidden no-underline">
            <div className="flex size-6 items-center justify-center rounded bg-neutral-900 text-xs font-bold text-white">
              q
            </div>
            <span className="text-sm font-bold text-neutral-900">quickgent</span>
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 no-underline transition-colors hover:text-neutral-900"
          >
            New to Quickgent? <span className="font-medium text-neutral-900">Sign up →</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Your agents are right where you left them.
            </p>

            {/* Google OAuth */}
            <button
              type="button"
              className="mt-8 inline-flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50"
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="mt-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-neutral-200" />
              <span className="text-xs text-neutral-400">or continue with email</span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>

            {errorMessage && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Email / Username */}
              <div>
                <label htmlFor="signin-email" className="block text-sm font-medium text-neutral-700">
                  Work email
                </label>
                <input
                  id="signin-email"
                  type="text"
                  required
                  autoComplete="username"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="jamie@acme.com"
                  className="mt-1.5 block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="signin-password" className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1.5 block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:ring-0 focus:outline-none"
                />
                <div className="mt-1.5 text-right">
                  <button type="button" className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900">
                    Forgot password? →
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Log in
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Security note */}
            <p className="mt-8 text-xs leading-relaxed text-neutral-400">
              Keep your account secure. Only log in on a device you trust.
            </p>

            {/* Support */}
            <p className="mt-6 text-xs text-neutral-400">
              Need help?{' '}
              <a href="mailto:support@quickgent.ai" className="text-neutral-600 no-underline hover:text-neutral-900">
                support@quickgent.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
