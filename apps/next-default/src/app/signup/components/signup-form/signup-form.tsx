'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSignup } from '../../context/signup.context';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardActions } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SignupForm() {
  const {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    isLoading,
    handleSubmit
  } = useSignup();

  return (
    <Card variant="elevated" className="w-full max-w-md mx-auto mui-elevation-3 border-indigo-500/20">
      <CardHeader
        title={<CardTitle className="text-2xl font-bold tracking-tight">Create Account</CardTitle>}
        subheader={<CardDescription>Join Ricoz Core Monorepo to get started</CardDescription>}
      />
      <form onSubmit={handleSubmit}>
        <CardContent className="gap-5">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          <Input
            id="name"
            type="text"
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
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
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            id="confirmPassword"
            type="password"
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" variant="contained" size="large" className="w-full mt-1 uppercase tracking-wider font-semibold" isLoading={isLoading}>
            Create Account
          </Button>
        </CardContent>
      </form>
      <CardActions className="justify-center border-t border-slate-800/80 py-4">
        <p className="text-xs text-slate-400">
          Already have an account?{' '}
          <Link href={PAGE_ROUTES.LOGIN} className="font-semibold text-indigo-400 hover:text-indigo-300 ml-1">
            Sign in
          </Link>
        </p>
      </CardActions>
    </Card>
  );
}
