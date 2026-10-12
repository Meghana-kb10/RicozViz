import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/badge';
import { APP_CONFIG } from '@/config/app.config';
import { ShieldIcon, CheckCircleIcon } from '@/assets/icons';

export function ProjectSummary() {
  const highlights = [
    { title: 'Modular Architecture', desc: 'Turborepo monorepo with strict package boundaries and shared packages' },
    { title: 'Material UI System', desc: 'Touch ripples, elevation shadows, outlined inputs and Material design tokens' },
    { title: 'Dual Client Parity', desc: 'Next.js App Router and Vite React Router v8 with unified config and structure' },
    { title: 'Reliable Backend', desc: 'Fastify with Mongoose, validation schemas, and console error logging' }
  ];

  return (
    <Card variant="elevated" className="max-w-xl mx-auto mui-elevation-2 border-slate-800/80">
      <CardHeader
        title={<CardTitle className="text-base font-semibold">About {APP_CONFIG.name}</CardTitle>}
        subheader={<CardDescription>{APP_CONFIG.description}</CardDescription>}
        action={
          <Chip variant="purple" styleVariant="filled" icon={<CheckCircleIcon className="w-3.5 h-3.5 text-purple-400" />}>
            v{APP_CONFIG.version}
          </Chip>
        }
      />
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mui-elevation-1 hover:border-indigo-500/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1 text-slate-200">
                <ShieldIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <h4 className="text-xs font-semibold">{item.title}</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
