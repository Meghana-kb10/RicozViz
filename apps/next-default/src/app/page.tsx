'use client';

import * as React from 'react';
import { HomeHeader } from './components/header/header';
import { UserProfileCard } from './components/user-profile/user-profile';
import { ProjectSummary } from './components/project-summary/project-summary';
import { HomeProvider } from './context/home.context';
import { Footer } from '@/components/layout/footer/footer';

export default function HomePage() {
  return (
    <HomeProvider>
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        <HomeHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-8 justify-center">
          <UserProfileCard />
          <ProjectSummary />
        </main>
        <Footer />
      </div>
    </HomeProvider>
  );
}
