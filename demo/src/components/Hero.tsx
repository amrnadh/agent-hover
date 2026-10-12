import React from "react";
import { motion } from "framer-motion";
import { Play, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";
import { DashboardPreview } from "./DashboardPreview";
import { useApp } from "../context/AppContext";

export const Hero: React.FC = () => {
  const { openDemoModal, openVideoModal } = useApp();

  const handleScrollDown = () => {
    const el = document.getElementById("social-proof");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="hero-section"
      className="relative w-full flex flex-col items-center overflow-hidden z-10 min-h-[92vh] pb-12"
    >
      {/* Background Video: Fullscreen muted autoplay loop video, absolute inset-0 w-full h-full object-cover z-0 */}
      <video
        id="hero-bg-video"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-90"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
      />

      {/* Subtle bottom gradient to blend video smoothly into content sections */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none z-5" />

      {/* All content wrapped in relative z-10 flex flex-col items-center w-full */}
      <div className="relative z-10 flex flex-col items-center w-full px-4 pt-1 sm:pt-2 md:pt-4">
        {/* 1. Badge (top) */}
        <motion.div
          id="hero-badge"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground font-body mb-6 shadow-2xs"
        >
          New: approval workflows ✨
        </motion.div>

        {/* 2. Headline */}
        <motion.h1
          id="hero-headline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center font-display text-5xl md:text-6xl lg:text-[5rem] leading-[0.95] tracking-tight text-foreground max-w-xl"
        >
          The Future of <span className="italic">Smarter</span> Automation
        </motion.h1>

        {/* 3. Subheadline */}
        <motion.p
          id="hero-subheadline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-4 text-center text-base md:text-lg text-muted-foreground max-w-[650px] leading-relaxed font-body"
        >
          Automate your busywork with intelligent agents that learn, adapt, and
          execute—so your team can focus on what matters most.
        </motion.p>

        {/* 4. CTA Buttons */}
        <motion.div
          id="hero-cta-group"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-5 flex items-center gap-3"
        >
          <Button
            id="hero-primary-cta"
            onClick={() => openDemoModal("Growth")}
            className="rounded-full px-6 py-5 text-sm font-medium font-body bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            Book a demo
          </Button>

          <Button
            id="hero-play-button"
            variant="ghost"
            onClick={openVideoModal}
            aria-label="Watch video demonstration"
            className="h-11 w-11 rounded-full border-0 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-background/80 p-0 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-foreground text-foreground ml-0.5" />
          </Button>
        </motion.div>

        {/* 5. Dashboard Preview (custom coded, NOT an image) with subtle floating animation */}
        <motion.div
          id="hero-dashboard-container"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-8 w-full max-w-5xl"
        >
          <motion.div
            id="hero-dashboard-floating-wrapper"
            animate={{
              y: [-6, 6, -6],
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-full will-change-transform"
          >
            <DashboardPreview />
          </motion.div>
        </motion.div>

        {/* Scroll hint indicator */}
        <motion.button
          onClick={handleScrollDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-8 flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
          aria-label="Scroll to discover features"
        >
          <span className="text-[11px] tracking-wide">Explore Platform Capabilities</span>
          <ArrowDown className="h-3.5 w-3.5 animate-bounce group-hover:text-accent transition-colors" />
        </motion.button>
      </div>
    </section>
  );
};
