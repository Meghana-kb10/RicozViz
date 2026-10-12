export const PAGE_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  AUTH: {
    ROOT: '/auth',
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT_PASSWORD: '/forgot-password',
  },
} as const;

export type PageRoutes = typeof PAGE_ROUTES;
