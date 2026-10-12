import * as React from 'react';
import { Link } from 'react-router';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/badge';
import { UserIcon } from '@/assets/icons';

export function HomeNavbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="flex items-center gap-3">
      {isAuthenticated ? (
        <div className="flex items-center gap-3">
          <Chip
            variant="primary"
            styleVariant="filled"
            icon={<UserIcon className="w-3.5 h-3.5 text-indigo-400" />}
            className="hidden sm:inline-flex"
          >
            {user?.name || user?.email}
          </Chip>
          <Button
            variant="danger"
            size="small"
            onClick={() => logout()}
          >
            Logout
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link to={PAGE_ROUTES.LOGIN}>
            <Button variant="contained" size="small">
              Sign In
            </Button>
          </Link>
          <Link to={PAGE_ROUTES.SIGNUP}>
            <Button variant="tonal" size="small">
              Sign Up
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
