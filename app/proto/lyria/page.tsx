"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface GeneratedTrack {
  id: string;
  title: string;
  prompt: string;
  model: string;
  genre?: string;
  mood?: string;
  isInstrumental: boolean;
  audioUrl: string;
  mimeType: string;
  notes?: string[];
  createdAt: number;
}

const PRESETS = [
  {
    title: "Cyberpunk Night Drive",
    genre: "Synthwave",
    mood: "Energetic",
    tempo: "124 BPM",
    isInstrumental: true,
    prompt:
      "Futuristic synthwave soundtrack with punchy 80s gated drums, a driving analog arpeggiated bassline, neon synth leads, and retro-futuristic atmosphere.",
  },
  {
    title: "Coffee Shop Lo-Fi",
    genre: "Lo-Fi Beats",
    mood: "Chill",
    tempo: "82 BPM",
    isInstrumental: true,
    prompt:
      "Warm dusty lo-fi hip hop beat with jazzy electric Rhodes chords, gentle vinyl crackle, subtle rain textures, and a relaxed boom-bap rhythm.",
  },
  {
    title: "Epic Cinematic Prelude",
    genre: "Orchestral",
    mood: "Uplifting",
    tempo: "95 BPM",
    isInstrumental: true,
    prompt:
      "Soaring cinematic film score with lush string ensemble, bold brass swell, deep cinematic percussion, and an inspiring emotional climax.",
  },
  {
    title: "Acoustic Sunset Ballad",
    genre: "Acoustic",
    mood: "Nostalgic",
    tempo: "76 BPM",
    isInstrumental: false,
    prompt:
      "Intimate acoustic guitar fingerpicking with warm cello harmonies, gentle room ambience, and a heartfelt, soulful vocal melody.",
  },
  {
    title: "Tokyo City Pop Groove",
    genre: "City Pop",
    mood: "Uplifting",
    tempo: "118 BPM",
    isInstrumental: true,
    prompt:
      "Bright 1980s Japanese city pop track featuring a funky slaped bass groove, crisp brass stabs, sparkling chorus guitars, and infectious rhythm.",
  },
  {
    title: "Deep Spatial Ambient",
    genre: "Ambient",
    mood: "Dreamy",
    tempo: "65 BPM",
    isInstrumental: true,
    prompt:
      "Ethereal generative ambient soundscape with shimmering granular reverb pads, sub-bass drones, and organic evolving acoustic echoes.",
  },
];

const GENRES = [
  "Synthwave",
  "Lo-Fi Beats",
  "Orchestral",
  "Ambient",
  "City Pop",
  "Deep House",
  "Acoustic",
  "Jazz Fusion",
  "Trap / Hip Hop",
  "Post-Rock",
];

const MOODS = [
  "Chill",
  "Energetic",
  "Dreamy",
  "Uplifting",
  "Nostalgic",
  "Dark / Moody",
  "Melancholic",
  "Euphoric",
];

export default function LyriaStudioPage() {
  // Config status
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [envVarName, setEnvVarName] = useState<string | null>(null);

  // Form State
  const [model, setModel] = useState<"lyria-3.5" | "lyria-3-clip-preview">("lyria-3.5");
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [selectedGenre, setSelectedGenre] = useState<string>(PRESETS[0].genre);
  const [selectedMood, setSelectedMood] = useState<string>(PRESETS[0].mood);
  const [tempo, setTempo] = useState<string>(PRESETS[0].tempo);
  const [isInstrumental, setIsInstrumental] = useState<boolean>(true);
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genStatusText, setGenStatusText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);

  // Audio Playback & Tracks History
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [activeTrack, setActiveTrack] = useState<GeneratedTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Fetch initial API config status
  useEffect(() => {
    fetch("/api/lyria", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setIsConfigured(Boolean(data.configured));
        if (data.envVarName) setEnvVarName(data.envVarName);
      })
      .catch(() => {
        setIsConfigured(false);
      });
  }, []);

  // Web Audio Visualizer Setup
  const setupVisualizer = () => {
    if (!audioRef.current || audioContextRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.warn("Visualizer audio context init bypassed:", e);
    }
  };

  // Canvas visualizer render loop
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 1.6;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.85;

          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, "rgba(147, 51, 234, 0.2)");
          gradient.addColorStop(0.5, "rgba(59, 130, 246, 0.8)");
          gradient.addColorStop(1, "rgba(6, 182, 212, 1)");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, 3);
          ctx.fill();

          x += barWidth;
        }
      } else {
        // Idle gentle waveform animation
        const time = Date.now() * 0.002;
        const bars = 32;
        const barWidth = width / bars;
        for (let i = 0; i < bars; i++) {
          const h = isGenerating
            ? (Math.sin(time * 3 + i * 0.4) * 0.5 + 0.5) * (height * 0.7) + 10
            : (Math.sin(time + i * 0.2) * 0.5 + 0.5) * 8 + 4;

          ctx.fillStyle = isGenerating ? "rgba(168, 85, 247, 0.6)" : "rgba(255, 255, 255, 0.08)";
          ctx.beginPath();
          ctx.roundRect(i * barWidth + 2, height / 2 - h / 2, barWidth - 4, h, 2);
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isGenerating]);

  // Handle music generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setErrorDetails(null);
    setGenStatusText("Connecting to Google DeepMind Lyria API...");

    const statusTimer1 = setTimeout(() => {
      setGenStatusText("Composing chords & harmonizing arrangement with Lyria...");
    }, 3000);
    const statusTimer2 = setTimeout(() => {
      setGenStatusText("Synthesizing 44.1kHz audio stream & applying SynthID watermark...");
    }, 8000);

    try {
      const res = await fetch("/api/lyria", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-google-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          prompt,
          model,
          genre: selectedGenre,
          mood: selectedMood,
          tempo,
          isInstrumental,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.details) {
          setErrorDetails(data.details);
        }
        throw new Error(data.error || `Generation failed (HTTP ${res.status})`);
      }

      // Create audio object URL from Base64
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || "audio/mp3" });
      const objectUrl = URL.createObjectURL(blob);

      const newTrack: GeneratedTrack = {
        id: `track-${Date.now()}`,
        title: prompt.slice(0, 45).replace(/[^\w\s]/gi, "").trim() || "Lyria Composition",
        prompt: data.prompt || prompt,
        model: data.model || model,
        genre: selectedGenre,
        mood: selectedMood,
        isInstrumental,
        audioUrl: objectUrl,
        mimeType: data.mimeType || "audio/mp3",
        notes: data.notes || [],
        createdAt: Date.now(),
      };

      setTracks((prev) => [newTrack, ...prev]);
      setActiveTrack(newTrack);

      // Play the newly generated track immediately
      setTimeout(() => {
        if (audioRef.current) {
          setupVisualizer();
          audioRef.current.src = objectUrl;
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        }
      }, 300);
    } catch (err: any) {
      console.error("Error generating Lyria track:", err);
      setErrorMsg(err.message || "An unexpected error occurred during music generation.");
    } finally {
      clearTimeout(statusTimer1);
      clearTimeout(statusTimer2);
      setIsGenerating(false);
      setGenStatusText("");
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setPrompt(preset.prompt);
    setSelectedGenre(preset.genre);
    setSelectedMood(preset.mood);
    setTempo(preset.tempo);
    setIsInstrumental(preset.isInstrumental);
  };

  const playTrack = (track: GeneratedTrack) => {
    setActiveTrack(track);
    if (audioRef.current) {
      setupVisualizer();
      audioRef.current.src = track.audioUrl;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !activeTrack) return;
    setupVisualizer();
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <main className="min-h-screen bg-[#07080c] text-zinc-100 selection:bg-purple-500 selection:text-white pb-24">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-purple-600/10 blur-[140px]" />
        <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Navigation Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/proto"
              className="group flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white transition"
              title="Back to Prototype Lab"
            >
              ←
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wide text-purple-400 border border-purple-500/20">
                  DEEPMIND LAB
                </span>
                <span className="inline-flex items-center rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wide text-cyan-400 border border-cyan-500/20">
                  SYNTHID ENABLED
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5 flex items-center gap-2">
                <span>Google Lyria Music Studio</span>
                <span className="text-xl">🎵</span>
              </h1>
            </div>
          </div>

          {/* Quick API Key status indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-1.5 backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConfigured || customApiKey ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="text-xs font-mono text-zinc-400">
                {isConfigured ? (
                  <>Key: <span className="text-emerald-400">{envVarName || "Active"}</span></>
                ) : customApiKey ? (
                  <span className="text-emerald-400">Custom Key Active</span>
                ) : (
                  <span className="text-amber-400">Key Not Detected</span>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 transition cursor-pointer"
            >
              {showKeyInput ? "Hide Key" : "⚙️ Key Settings"}
            </button>
          </div>
        </header>

        {/* Collapsible Key Config Banner */}
        {(showKeyInput || isConfigured === false) && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <span>🔑</span> Google AI API Key Configuration
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl">
                  Add your Google AI Studio key to <code className="rounded bg-black/60 px-1.5 py-0.5 text-amber-200 font-mono">.env.local</code> as <code className="rounded bg-black/60 px-1.5 py-0.5 text-amber-200 font-mono">GEMINI_API_KEY=AIza...</code>, or enter a temporary session key below.
                </p>
              </div>

              <div className="flex w-full md:w-auto items-center gap-2">
                <input
                  type="password"
                  placeholder="Paste Google AI Key (AIza...)"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="rounded-xl border border-zinc-700 bg-black/60 px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-amber-400 w-full md:w-72"
                />
                {customApiKey && (
                  <button
                    type="button"
                    onClick={() => setCustomApiKey("")}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Composer Form Controls (7 cols) */}
          <section className="lg:col-span-7 space-y-6">
            <form onSubmit={handleGenerate} className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
              
              {/* Model Choice Tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    DeepMind Lyria Model Architecture
                  </label>
                  <span className="text-[10px] font-mono text-purple-400">Generative Music v3</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModel("lyria-3.5")}
                    className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
                      model === "lyria-3.5"
                        ? "border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Lyria 3.5</span>
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-purple-300">
                        Full Track
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Cohesive song structure with intros, hooks, verse-chorus progression.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModel("lyria-3-clip-preview")}
                    className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
                      model === "lyria-3-clip-preview"
                        ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                        : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Lyria 3 Clip</span>
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300">
                        Loop / Stem
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Fast synthesis optimized for 30s clips, soundbeds, and interactive loops.
                    </p>
                  </button>
                </div>
              </div>

              {/* Quick Presets Carousel */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                  Sound Design Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 hover:border-purple-500/50 hover:text-purple-300 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⚡</span>
                      <span>{preset.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Textarea */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between mb-2">
                  <span>Music Prompt Description</span>
                  <span className="text-[10px] font-mono text-zinc-500">{prompt.length} chars</span>
                </label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe instruments, vibes, drum styles, bassline, and sonic atmosphere..."
                  required
                  className="w-full rounded-2xl border border-zinc-700 bg-black/60 p-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition leading-relaxed resize-y"
                />
              </div>

              {/* Style Controls (Genre, Mood, Tempo, Vocals) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Genre Archetype
                  </label>
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3.5 py-2.5 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {GENRES.map((g) => (
                      <option key={g} value={g} className="bg-zinc-900 text-white">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Emotional Mood
                  </label>
                  <select
                    value={selectedMood}
                    onChange={(e) => setSelectedMood(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3.5 py-2.5 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {MOODS.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Tempo / Speed
                  </label>
                  <input
                    type="text"
                    value={tempo}
                    onChange={(e) => setTempo(e.target.value)}
                    placeholder="e.g. 120 BPM, Slow, Driving"
                    className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Vocal Composition
                  </label>
                  <div className="flex rounded-xl border border-zinc-700 bg-black/60 p-1">
                    <button
                      type="button"
                      onClick={() => setIsInstrumental(true)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition cursor-pointer ${
                        isInstrumental ? "bg-purple-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Instrumental
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInstrumental(false)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition cursor-pointer ${
                        !isInstrumental ? "bg-purple-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      With Vocals
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message Alert */}
              {errorMsg && (
                <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 text-xs font-mono text-red-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <span>⚠️</span> Generation Error
                  </div>
                  <p className="leading-relaxed">{errorMsg}</p>
                  {errorDetails && (
                    <details className="mt-3 rounded-xl border border-zinc-800 bg-black/60 p-3 text-[11px] text-zinc-400">
                      <summary className="cursor-pointer font-bold text-zinc-300 hover:text-white select-none">
                        🔍 View API Diagnostic Details
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-x-auto rounded bg-zinc-950 p-2.5 text-[10px] text-zinc-400 font-mono leading-relaxed">
                        {JSON.stringify(errorDetails, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating || (!isConfigured && !customApiKey)}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-purple-500/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>{genStatusText || "Synthesizing with Google Lyria..."}</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Generate Music with Google Lyria</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* RIGHT: Live Audio Player & Waveform Visualizer (5 cols) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Player Card */}
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-xl shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Live Master Monitor
                </span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400">
                  44.1 kHz Stereo
                </span>
              </div>

              {/* Waveform Canvas */}
              <div className="relative h-32 w-full rounded-2xl border border-zinc-800 bg-black/80 overflow-hidden flex items-center justify-center p-2">
                <canvas
                  ref={visualizerCanvasRef}
                  width={400}
                  height={128}
                  className="w-full h-full object-contain"
                />
                {!activeTrack && !isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none text-center p-4">
                    <span className="text-3xl mb-1">🎼</span>
                    <p className="text-xs text-zinc-400 font-mono">Ready to compose your first Lyria track</p>
                  </div>
                )}
              </div>

              {/* Active Track Metadata & Scrubber */}
              {activeTrack ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-white truncate">{activeTrack.title}</h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{activeTrack.prompt}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="rounded-md border border-zinc-800 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                        {activeTrack.model}
                      </span>
                      {activeTrack.genre && (
                        <span className="rounded-md border border-zinc-800 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                          {activeTrack.genre}
                        </span>
                      )}
                      <span className="rounded-md border border-zinc-800 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                        {activeTrack.isInstrumental ? "Instrumental" : "Vocal"}
                      </span>
                    </div>
                  </div>

                  {/* Scrubber Range */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={audioDuration || 100}
                      value={audioCurrentTime}
                      onChange={(e) => {
                        const newTime = Number(e.target.value);
                        setAudioCurrentTime(newTime);
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime;
                        }
                      }}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                      <span>{formatTime(audioCurrentTime)}</span>
                      <span>{formatTime(audioDuration)}</span>
                    </div>
                  </div>

                  {/* Playback Controls Bar */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="rounded-2xl bg-white hover:bg-zinc-200 text-black px-6 py-3 text-xs font-black uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center gap-2 shadow-lg"
                    >
                      <span>{isPlaying ? "⏸ Pause" : "▶ Play"}</span>
                    </button>

                    <a
                      href={activeTrack.audioUrl}
                      download={`lyria-${activeTrack.id}.mp3`}
                      className="rounded-2xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 px-4 py-3 text-xs font-bold text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⬇</span>
                      <span>Download MP3</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                  Select a preset and click generate to synthesize audio.
                </div>
              )}

              {/* Hidden HTML5 Audio Element for playback */}
              <audio
                ref={audioRef}
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setAudioCurrentTime(audioRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setAudioDuration(audioRef.current.duration);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>

            {/* Generated Tracks Session History */}
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📜</span> Session Takes ({tracks.length})
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">Local Memory</span>
              </div>

              {tracks.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center font-mono">
                  Generated audio takes will appear here.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {tracks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => playTrack(t)}
                      className={`group rounded-2xl border p-3.5 transition cursor-pointer flex items-center justify-between gap-3 ${
                        activeTrack?.id === t.id
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-zinc-800/70 bg-zinc-900/30 hover:border-zinc-700"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate group-hover:text-purple-300">
                          {t.title}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {t.genre || "Custom"} · {t.model}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 font-mono">
                          {activeTrack?.id === t.id && isPlaying ? "▶ Playing" : "▶"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </section>

        </div>
      </div>
    </main>
  );
}
