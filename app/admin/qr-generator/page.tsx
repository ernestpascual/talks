"use client";

import { useEffect, useRef, useState, useSyncExternalStore, FormEvent } from "react";
import { isAuthenticated, login, logout } from "@/lib/admin-auth";
import QRCode from "qrcode";

function subscribe() {
  return () => {};
}

export default function AdminQrGeneratorPage() {
  const storedAuthed = useSyncExternalStore(
    subscribe,
    isAuthenticated,
    () => false,
  );
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const authed = signedIn ?? storedAuthed;

  // QR settings state
  const [targetUrl, setTargetUrl] = useState("/experience/aerocano-survey");
  const [hostUrl, setHostUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize host URL from window location
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHostUrl(window.location.origin);
    }
  }, []);

  // Fetch current redirect target on mount if authenticated
  useEffect(() => {
    if (!authed) return;
    async function fetchRedirect() {
      try {
        const res = await fetch("/api/redirect?slug=live");
        const data = await res.json();
        if (data.success && data.url) {
          setTargetUrl(data.url);
        }
      } catch (err) {
        console.error("Failed to load current redirect:", err);
      }
    }
    fetchRedirect();
  }, [authed]);

  // Generate QR code on canvas whenever hostUrl or targetUrl changes
  const qrDataUrl = `${hostUrl || "http://localhost:3000"}/r/live`;

  useEffect(() => {
    if (!canvasRef.current || !authed) return;

    QRCode.toCanvas(
      canvasRef.current,
      qrDataUrl,
      {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      },
      (err) => {
        if (err) console.error("QR Code Error:", err);
      }
    );
  }, [qrDataUrl, authed]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (login(password)) {
      setSignedIn(true);
      setPassword("");
      return;
    }
    setError("Incorrect password.");
  }

  function handleLogout() {
    logout();
    setSignedIn(false);
    setPassword("");
    setError("");
  }

  // Save redirection mapping to DB
  async function handleSaveRedirect() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    const adminPassword = localStorage.getItem("admin-password") || "";

    try {
      const res = await fetch("/api/redirect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          slug: "live",
          url: targetUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error || "Failed to update redirect");
      }
    } catch (err) {
      setSaveError("Failed to update redirect due to network error");
    } finally {
      setSaving(false);
    }
  }

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "aerocano-live-qr.png";
    a.click();
  };

  // Sign In view if not authed
  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16 text-white bg-zinc-950 antialiased">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-md">
          <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to access the Dynamic QR Code Generator.
          </p>
          <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-300">
              Admin Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-base text-white focus:border-amber-500 focus:outline-none transition-colors"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              className="rounded-full bg-white hover:bg-zinc-200 active:scale-95 transition-all py-3.5 text-sm font-bold text-black shadow-lg shadow-white/10"
            >
              Sign in
            </button>
          </form>
        </div>
      </main>
    );
  }

  // QR Generator Panel view
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12 text-white bg-zinc-950 antialiased">
      <div className="flex flex-col md:flex-row gap-8 items-stretch">
        
        {/* Left Side: Controls */}
        <div className="flex-1 flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-md">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Utilities</span>
                <h1 className="text-2xl font-bold tracking-tight mt-1">Dynamic QR Manager</h1>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline decoration-dotted transition-colors"
              >
                Log out
              </button>
            </div>

            <hr className="border-zinc-800" />

            {/* Config target URL */}
            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-300">
                Destination URL
                <p className="text-xs text-zinc-500 font-normal">Where scanning the QR code redirects participants in real-time.</p>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none transition-colors font-mono"
                  placeholder="e.g. /experience/aerocano-survey"
                  required
                />
              </label>

              {/* Quick Presets */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-400">Quick Presets:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetUrl("/experience/aerocano-survey")}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      targetUrl === "/experience/aerocano-survey"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 text-zinc-300"
                    }`}
                  >
                    Survey Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetUrl("/experience/aerocano-shake")}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      targetUrl === "/experience/aerocano-shake"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 text-zinc-300"
                    }`}
                  >
                    Shaker Game
                  </button>
                </div>
              </div>

              {/* Host URL Override */}
              <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-300 pt-2">
                Base Domain (Host)
                <input
                  type="text"
                  value={hostUrl}
                  onChange={(e) => setHostUrl(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none transition-colors font-mono"
                  placeholder="https://talks.ernestpascual.com"
                />
              </label>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {saveError && (
              <p className="text-sm text-red-400 bg-red-950/20 border border-red-500/30 rounded-xl p-3">{saveError}</p>
            )}
            {saveSuccess && (
              <p className="text-sm text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3">
                ✓ Redirect updated successfully!
              </p>
            )}
            <button
              type="button"
              onClick={handleSaveRedirect}
              disabled={saving}
              className="w-full rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all py-4 text-sm font-bold tracking-wide text-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Saving Redirect...
                </>
              ) : (
                "Save Redirect Destination"
              )}
            </button>
          </div>
        </div>

        {/* Right Side: QR Preview */}
        <div className="w-full md:w-80 flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-md gap-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">QR Code Preview</span>
          
          <div className="bg-white p-4 rounded-2xl shadow-inner flex items-center justify-center overflow-hidden w-full aspect-square">
            <canvas ref={canvasRef} className="w-full h-full max-w-[240px] max-h-[240px]" />
          </div>

          <div className="space-y-4 w-full">
            <div className="text-zinc-500 font-mono text-[10px] break-all leading-relaxed px-2">
              Encodes:<br />
              <span className="text-zinc-300 font-bold">{qrDataUrl}</span>
            </div>
            
            <button
              type="button"
              onClick={handleDownload}
              className="w-full rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 active:scale-95 transition-all py-3 text-xs font-semibold uppercase tracking-wider text-zinc-300"
            >
              Download QR (PNG)
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
