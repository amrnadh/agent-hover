import React, { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Play, Pause, Maximize, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";

export const VideoModal: React.FC = () => {
  const { isVideoModalOpen, closeVideoModal } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);

  const chapters = [
    { title: "Autonomous Agent Orchestration", time: "0:00" },
    { title: "Dual-Key Financial Safeguards", time: "0:45" },
    { title: "Real-time Mercury & AWS Reconciliation", time: "1:30" },
  ];

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  if (!isVideoModalOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="video-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-md"
        onClick={closeVideoModal}
      >
        <motion.div
          id="video-modal-container"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl rounded-2xl bg-black border border-border/40 shadow-2xl overflow-hidden font-body text-white flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-zinc-900/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-zinc-200">
                Nexora Architecture Walkthrough (4K)
              </span>
              <span className="text-[10px] bg-accent/20 text-accent font-medium px-2 py-0.5 rounded-full">
                Interactive Demo
              </span>
            </div>
            <button
              onClick={closeVideoModal}
              className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md"
              aria-label="Close video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Video Player */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              className="w-full h-full object-cover"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
            />

            {/* Overlay Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center text-white transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-white" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  onClick={toggleMute}
                  className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center text-white transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  onClick={handleRestart}
                  className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center text-white transition-colors"
                  aria-label="Restart video"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Chapters */}
              <div className="hidden sm:flex items-center gap-2">
                {chapters.map((ch, idx) => (
                  <button
                    key={ch.title}
                    onClick={() => setActiveChapter(idx)}
                    className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                      activeChapter === idx
                        ? "bg-accent text-white"
                        : "bg-white/10 text-zinc-300 hover:bg-white/20"
                    }`}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
