import * as React from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardActions } from '@/components/ui/card';
import { Chip } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserIcon, ShieldIcon, LogOutIcon, ArrowRightIcon } from '@/assets/icons';

export function UserProfileCard() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <Card variant="elevated" className="max-w-xl mx-auto border-indigo-500/20 bg-slate-900/90 mui-elevation-2">
        <div className="flex flex-col items-center justify-center p-12 gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Loading profile...</span>
        </div>
      </Card>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Card variant="elevated" className="max-w-xl mx-auto mui-elevation-2 text-center overflow-hidden">
        <CardHeader
          avatar={
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mui-elevation-1">
              <UserIcon className="w-7 h-7" />
            </div>
          }
          title={<CardTitle className="text-xl">Welcome to Core Mono</CardTitle>}
          subheader={
            <CardDescription className="text-slate-400 max-w-sm mx-auto">
              You are currently browsing as an unauthenticated guest. Sign in to view your profile and manage account credentials.
            </CardDescription>
          }
          className="flex flex-col items-center text-center pt-8 pb-4"
        />
        <CardContent>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to={PAGE_ROUTES.LOGIN}>
              <Button variant="contained" size="medium" endIcon={<ArrowRightIcon className="w-4 h-4" />}>
                Sign In
              </Button>
            </Link>
            <Link to={PAGE_ROUTES.SIGNUP}>
              <Button variant="outlined" size="medium">
                Create Account
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="max-w-xl mx-auto mui-elevation-3 border-indigo-500/30">
      <CardHeader
        avatar={
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xl mui-elevation-2">
            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
          </div>
        }
        title={<CardTitle className="text-xl">{user.name || 'Authenticated User'}</CardTitle>}
        subheader={<CardDescription>{user.email}</CardDescription>}
        action={
          <Chip variant="success" styleVariant="filled">
            Active Session
          </Chip>
        }
      />
      <CardContent>
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800 mui-elevation-1">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              User ID
            </span>
            <span className="text-xs font-mono text-slate-300 break-all">{user.id}</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Role
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Chip
                variant="primary"
                styleVariant="outlined"
                icon={<ShieldIcon className="w-3.5 h-3.5 text-indigo-400" />}
              >
                {user.role.toUpperCase()}
              </Chip>
            </div>
          </div>
        </div>
      </CardContent>
      <CardActions>
        <Button variant="danger" size="small" startIcon={<LogOutIcon className="w-3.5 h-3.5" />} onClick={() => logout()}>
          Sign Out
        </Button>
      </CardActions>
    </Card>
  );
}
