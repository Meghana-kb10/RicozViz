import {
  setAdminRefreshHandler,
  setAdminAccessToken,
  getAdminAccessToken,
  clearAdminAccessToken,
  AdminApiError
} from '@repo/api';

// Wire refresh handler to call the local BFF Next.js route handler proxy
if (typeof window !== 'undefined') {
  setAdminRefreshHandler(async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      if (!res.ok) {
        clearAdminAccessToken();
        return null;
      }

      const data = await res.json();
      const newAccessToken = data.accessToken || data.data?.accessToken;
      if (newAccessToken) {
        setAdminAccessToken(newAccessToken);
        return newAccessToken;
      }

      clearAdminAccessToken();
      return null;
    } catch {
      clearAdminAccessToken();
      return null;
    }
  });
}

export {
  getAdminAccessToken,
  setAdminAccessToken,
  clearAdminAccessToken,
  AdminApiError
};
