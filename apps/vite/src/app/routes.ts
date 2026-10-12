import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes';

export default [
  index('page.tsx'),

  // Authentication Routes
  layout('auth/layout.tsx', [
    route('login', 'auth/login/page.tsx'),
    route('signup', 'auth/signup/page.tsx'),
    route('forgot-password', 'auth/forgot-password/page.tsx'),
  ]),
] satisfies RouteConfig;
