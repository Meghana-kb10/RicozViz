"use client";

import React, { useState } from "react";
import HeroBentoSection from "@/components/landing/HeroBentoSection";
import InteractiveWorkbench from "@/components/landing/InteractiveWorkbench";
import CapabilityGrid from "@/components/landing/CapabilityGrid";
import WorkflowPipelineSection from "@/components/landing/WorkflowPipelineSection";
import ParticleCtaSection from "@/components/landing/ParticleCtaSection";
import ComprehensiveFooter from "@/components/landing/ComprehensiveFooter";

export default function HomePage() {
  const [selectedConnector, setSelectedConnector] =
    useState<string>("PostgreSQL");

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
