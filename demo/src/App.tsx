import React from "react";
import { AppProvider } from "./context/AppContext";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SocialProof } from "./components/SocialProof";
import { Features } from "./components/Features";
import { WorkflowSimulator } from "./components/WorkflowSimulator";
import { Integrations } from "./components/Integrations";
import { Pricing } from "./components/Pricing";
import { Testimonials } from "./components/Testimonials";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { DemoModal } from "./components/DemoModal";
import { VideoModal } from "./components/VideoModal";
import { CommandMenu } from "./components/CommandMenu";
import { ToastContainer } from "./components/ToastContainer";

export default function App() {
  return (
    <AppProvider>
      <div
        id="nexora-saas-root"
        className="min-h-screen flex flex-col bg-background text-foreground selection:bg-accent/20 selection:text-foreground relative"
      >
        {/* Sticky Header */}
        <Navbar />

        {/* Hero with Video, Badge, Typography, and Interactive Dashboard */}
        <Hero />

        {/* Social Proof & Metrics */}
        <SocialProof />

        {/* Core Architecture Features */}
        <Features />

        {/* Interactive Live Workflow Simulator */}
        <WorkflowSimulator />

        {/* 100+ Integrations Ecosystem */}
        <Integrations />

        {/* Pricing Tiers with Annual Toggle */}
        <Pricing />

        {/* Customer Validation & Testimonials */}
        <Testimonials />

        {/* FAQ Accordion */}
        <FAQ />

        {/* Comprehensive Footer with CTA */}
        <Footer />

        {/* Global Modals & Controls */}
        <DemoModal />
        <VideoModal />
        <CommandMenu />
        <ToastContainer />
      </div>
    </AppProvider>
  );
}
