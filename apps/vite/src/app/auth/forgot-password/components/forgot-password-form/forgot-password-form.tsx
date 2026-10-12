import * as React from 'react';
import { Link } from 'react-router';
import { useForgotPassword } from '../../context/forgot-password.context';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardActions } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ForgotPasswordForm() {
  const { email, setEmail, statusMessage, error, isLoading, handleSubmit } = useForgotPassword();

  return (
    <Card variant="elevated" className="w-full max-w-md mx-auto mui-elevation-3 border-indigo-500/20">
      <CardHeader
        title={<CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>}
        subheader={
          <CardDescription>
            Enter your account email and we will send password reset instructions
          </CardDescription>
        }
      />
      <form onSubmit={handleSubmit}>
        <CardContent className="gap-5">
          {statusMessage && (
            <div className="p-3.5 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>{statusMessage}</span>
            </div>
          )}
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          <Input
            id="email"
            type="email"
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Button type="submit" variant="contained" size="large" className="w-full mt-1 uppercase tracking-wider font-semibold" isLoading={isLoading}>
            Send Recovery Email
          </Button>
        </CardContent>
      </form>
      <CardActions className="justify-center border-t border-slate-800/80 py-4">
        <p className="text-xs text-slate-400">
          Remember your password?{' '}
          <Link to={PAGE_ROUTES.LOGIN} className="font-semibold text-indigo-400 hover:text-indigo-300 ml-1">
            Back to sign in
          </Link>
        </p>
      </CardActions>
    </Card>
  );
}
