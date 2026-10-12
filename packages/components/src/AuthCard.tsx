import * as React from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { cn } from '@repo/utils';

export type AuthMode = 'login' | 'register' | 'forgot-password';

export interface AuthCardProps {
  className?: string;
  initialMode?: AuthMode;
  onSuccess?: () => void;
  onBackToHome?: () => void;
}

export function AuthCard({
  className,
  initialMode = 'login',
  onSuccess,
  onBackToHome
}: AuthCardProps) {
  const { user, token, isAuthenticated, isLoading, login, register, forgotPassword, logout } = useAuth();

  const [mode, setMode] = React.useState<AuthMode>(initialMode);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'user' | 'guest'>('user');
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const resetFormState = () => {
    setError(null);
    setActionSuccess(null);
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    resetFormState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (mode === 'login') {
      const res = await login({ email, password });
      if (res.success) {
        setActionSuccess('Logged in successfully!');
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Invalid email or password');
      }
    } else if (mode === 'register') {
      const res = await register({ name, email, password, role });
      if (res.success) {
        setActionSuccess('Account created and logged in!');
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Failed to create account');
      }
    } else if (mode === 'forgot-password') {
      const res = await forgotPassword({ email });
      if (res.success) {
        setActionSuccess(res.message || 'Password reset instructions have been sent to your email.');
      } else {
        setError(res.error || 'Failed to send reset instructions');
      }
    }
  };

  // If already authenticated and user details exist
  if (isAuthenticated && user) {
    return (
      <Card
        title="Account Profile"
        subtitle="You are currently signed in"
        className={cn('border-slate-800 bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur-md max-w-md w-full mx-auto', className)}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-100 text-base truncate">{user.name}</h4>
                <Badge variant={user.role === 'admin' ? 'info' : 'success'}>
                  {user.role}
                </Badge>
              </div>
              <p className="text-sm text-slate-400 truncate mt-0.5">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-mono">
                  Session Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {onBackToHome && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onBackToHome}
                className="flex-1 text-slate-300 border-slate-700 hover:bg-slate-800"
              >
                Back to Home
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={logout}
              disabled={isLoading}
              className="flex-1"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        mode === 'login'
          ? 'Sign In'
          : mode === 'register'
            ? 'Create Account'
            : 'Forgot Password'
      }
      subtitle={
        mode === 'login'
          ? 'Enter your credentials to access your account'
          : mode === 'register'
            ? 'Sign up to get started with the platform'
            : 'Enter your email to receive password reset instructions'
      }
      className={cn(
        'border-slate-800 bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur-md max-w-md w-full mx-auto',
        className
      )}
    >
      <div className="space-y-5">
        {/* Mode selector pills (for login and register) */}
        {mode !== 'forgot-password' && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800/80 rounded-xl border border-slate-700/50">
            <button
              type="button"
              onClick={() => handleModeChange('login')}
              className={cn(
                'py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('register')}
              className={cn(
                'py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          {mode !== 'forgot-password' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleModeChange('forgot-password')}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Account Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800/90 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="user">User (Standard Access)</option>
                <option value="admin">Admin (Full Administrative Privileges)</option>
                <option value="guest">Guest (Read-Only)</option>
              </select>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/30 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs border border-emerald-500/30 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Send Reset Instructions'}
          </Button>

          {/* Navigation helpers between modes */}
          <div className="pt-2 text-center text-xs text-slate-400 space-y-2">
            {mode === 'forgot-password' && (
              <button
                type="button"
                onClick={() => handleModeChange('login')}
                className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline cursor-pointer"
              >
                ← Back to Sign In
              </button>
            )}

            {mode === 'login' && (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeChange('register')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </p>
            )}

            {mode === 'register' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}

            {onBackToHome && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="text-slate-500 hover:text-slate-300 text-xs font-medium cursor-pointer"
                >
                  ← Return to Home
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
