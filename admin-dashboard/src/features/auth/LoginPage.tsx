import { useState, type FormEvent } from 'react';
import { Gamepad2, Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useAuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const { login, isLoggingIn, loginError } = useAuth();
  const { login: ctxLogin } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
    } catch { /* handled by mutation */ }
  }

  function handleDemoMode() {
    ctxLogin('demo-token', 'demo-refresh', { id: 'demo', username: 'admin', email: 'admin@demo.local' });
    navigate('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
            <Gamepad2 size={24} className="text-accent" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-[#e6edf3]">Playnet Admin</h1>
            <p className="mt-1 text-sm text-muted">Sign in to the admin panel</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@game.local"
              className="w-full rounded-md border border-border bg-main px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-muted focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-main px-3 py-2.5 pr-10 text-sm text-[#e6edf3] placeholder:text-muted focus:border-accent focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[#e6edf3]"
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {loginError && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger border border-danger/20">
              Invalid credentials. Check your email and password.
            </p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-sidebar hover:bg-accent-hover disabled:opacity-60 transition-colors"
          >
            {isLoggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Demo mode */}
        <div className="mt-4">
          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted">o</span>
            <div className="flex-1 border-t border-border" />
          </div>
          <button
            onClick={handleDemoMode}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted hover:border-accent/40 hover:text-[#e6edf3] transition-colors"
          >
            <Zap size={14} className="text-accent" />
            Demo Mode (no backend)
          </button>
        </div>
      </div>
    </div>
  );
}
