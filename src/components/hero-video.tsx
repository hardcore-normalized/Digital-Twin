"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

/**
 * Product motion graphic for the landing hero (made in HyperFrames, source in /hero-video;
 * music generated with ACE-Step 1.5). Browsers only autoplay muted video, so it starts
 * silent with a sound toggle. Respects "reduce motion" and always offers pause.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!reduce.matches) video.play().catch(() => setPlaying(false));
  }, []);

  const togglePlay = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    // Turning sound on is a clear signal they want to watch: start from the top.
    if (!video.muted) {
      video.currentTime = 0;
      video.play().catch(() => undefined);
    }
  };

  const control =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card/90 text-[13px] font-medium text-text shadow-sm backdrop-blur hover:bg-card";

  return (
    <div className="group relative">
      <video
        ref={ref}
        className="block aspect-video w-full bg-[#f7f5f0]"
        poster="/hero/poster.jpg"
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="Product tour: each person gets a digital twin built from their check-ins and AI usage counts, never their private conversations. Twins are four plain files, answer questions with sources, and log every question for the person to see. Then usage monitoring: spend per seat and idle seats. Made for everyone, designed for Claude."
      >
        <source src="/hero/digital-twin-hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute right-3 bottom-3 flex items-center gap-2">
        <button type="button" onClick={toggleSound} aria-pressed={!muted} className={`${control} px-3`}>
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          <span className="hidden sm:inline">{muted ? "Sound off" : "Sound on"}</span>
        </button>
        <button type="button" onClick={togglePlay} aria-label={playing ? "Pause video" : "Play video"} className={`${control} w-9`}>
          {playing ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
        </button>
      </div>
    </div>
  );
}
