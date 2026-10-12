'use client';

import { useAuth as useAuthFromContext } from '@/context/auth.context';

export function useAuth() {
  return useAuthFromContext();
}
