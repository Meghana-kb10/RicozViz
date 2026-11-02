"use client";

import React, { useState, useEffect } from "react";
import HeroBentoSection from "@/components/landing/HeroBentoSection";
import InteractiveWorkbench from "@/components/landing/InteractiveWorkbench";
import CapabilityGrid from "@/components/landing/CapabilityGrid";
import WorkflowPipelineSection from "@/components/landing/WorkflowPipelineSection";
import ParticleCtaSection from "@/components/landing/ParticleCtaSection";
import ComprehensiveFooter from "@/components/landing/ComprehensiveFooter";

export default function HomePage() {
  const [selectedConnector, setSelectedConnector] =
    useState<string>("PostgreSQL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#fafafa] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#242424] border-t-[#ff6b35]" />
          <span className="text-xs font-mono-code text-[#898989]">Loading RicozViz OS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#fafafa]">
      {/* 1. Header, Hero Headline, Subtitle & 12-Column Product Bento Grid */}
      <HeroBentoSection
        selectedConnector={selectedConnector}
        onSelectConnector={setSelectedConnector}
      />

      {/* 2. Framed Monochrome Connectors & Live SQL Studio Workbench */}
      <InteractiveWorkbench
        selectedConnector={selectedConnector}
        onSelectConnector={setSelectedConnector}
      />

      {/* 3. Platform Capabilities & Pipeline Stepper */}
      <div id="piece-governance-social" className="flex flex-col gap-[88px] pb-[80px]">
        {/* Capability Code Inspector & Platform Pillars */}
        <CapabilityGrid />

        {/* 5-Stage End-to-End Analytics Pipeline */}
        <WorkflowPipelineSection />
      </div>

      {/* 4. Dynamic Particle Call to Action */}
      <ParticleCtaSection />

      {/* 5. Comprehensive Platform Footer */}
      <ComprehensiveFooter />
    </div>
  );
}
