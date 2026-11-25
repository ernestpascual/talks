"use client";

import React, { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isAuthenticated, login, logout, getAdminPassword } from "@/lib/admin-auth";
import type { RedirectItem } from "@/lib/db";
import type { ManagedRoute, RouteStatus } from "@/lib/route-guard-types";
import Link from "next/link";
import QRCode from "qrcode";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { onValue, ref } from "firebase/database";
import { firestore, realtimeDatabase } from "@/lib/firebase";
import {
  normalizeSubstrateSubmission,
  SUBSTRATE_COLLECTION,
  SUBSTRATE_TUNING_PATH,
  type SubstrateSubmission,
} from "@/lib/substrate-blob";
import DungeonsAdmin from "./DungeonsAdmin";

function subscribe() {
  return () => {};
}

const PRESET_DESTINATIONS = [
  { label: "Aerocano Survey", url: "/experience/aerocano-survey" },
  { label: "Dragon Slayer", url: "/experience/dragon-slayer" },
  { label: "WRU?! Radar", url: "/experience/find-your-officemate" },
  { label: "Aerocano Talk", url: "/talks/aerocano" },
  { label: "BBDO AI Playday", url: "/talks/bbdo-ai-playday" },
  { label: "BBDO Creative Substrates", url: "/experience/substrate-blob" },
  { label: "Raw School 2026", url: "/talks/raw-school-2026" },
];

export default function AdminPage() {
  const storedAuthed = useSyncExternalStore(subscribe, isAuthenticated, () => false);

  // Authentication State
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const authed = signedIn ?? storedAuthed;

  // Active Tab
  const [activeTab, setActiveTab] = useState<"qr" | "dash" | "bbdo" | "dungeons" | "talks" | "experience">("qr");

  // Dynamic QR Code Form State
  const [qrTitle, setQrTitle] = useState("Audience Live Survey");
  const [qrSlug, setQrSlug] = useState("live");
  const [qrTargetUrl, setQrTargetUrl] = useState("/experience/aerocano-survey");
  const [hostUrl, setHostUrl] = useState("");
  const [savingQr, setSavingQr] = useState(false);
  const [qrSaveMsg, setQrSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dynamic QR Codes Directory State
  const [redirects, setRedirects] = useState<RedirectItem[]>([]);
  const [loadingRedirects, setLoadingRedirects] = useState(false);
  const [redirectSearch, setRedirectSearch] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  // Live Dash Summary State
  const [surveyCount, setSurveyCount] = useState<number>(0);
  const [scoresCount, setScoresCount] = useState<number>(0);

  // Route Guards State (Talks & Experience Access Control)
  const [routeGuards, setRouteGuards] = useState<ManagedRoute[]>([]);
  const [loadingGuards, setLoadingGuards] = useState(false);
  const [guardSaveMsg, setGuardSaveMsg] = useState<{ id: string; text: string } | null>(null);
  const [searchTalks, setSearchTalks] = useState("");
  const [searchExp, setSearchExp] = useState("");

  // Slide 3 tuning visibility (stored in Firebase Realtime Database)
  const [liveTuningVisible, setLiveTuningVisible] = useState(false);
  const [savingTuning, setSavingTuning] = useState(false);
  const [tuningMsg, setTuningMsg] = useState("");

  // BBDO AI Creative Substrates (Firestore)
  const [substrateResponses, setSubstrateResponses] = useState<SubstrateSubmission[]>([]);
  const [loadingSubstrates, setLoadingSubstrates] = useState(true);
  const [substrateError, setSubstrateError] = useState("");
  const [deletingSubstrate, setDeletingSubstrate] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize Host Origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      const frame = window.requestAnimationFrame(() => {
        setHostUrl(window.location.origin);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  // Fetch all admin data when authenticated
  const fetchAdminData = async () => {
    setLoadingRedirects(true);
    setLoadingGuards(true);
    try {
      const [redRes, surveyRes, scoresRes, guardsRes] = await Promise.all([
        fetch("/api/redirect?all=1", { cache: "no-store" }),
        fetch("/api/survey", { cache: "no-store" }).catch(() => null),
        fetch("/api/scores", { cache: "no-store" }).catch(() => null),
        fetch("/api/route-guard?all=1", { cache: "no-store" }).catch(() => null),
      ]);

      if (redRes.ok) {
        const data = await redRes.json();
        if (data.success && Array.isArray(data.redirects)) {
          setRedirects(data.redirects);
        }
      }

      if (surveyRes && surveyRes.ok) {
        const sData = await surveyRes.json();
        if (sData.success && Array.isArray(sData.list)) {
          setSurveyCount(sData.list.length);
        }
      }

      if (scoresRes && scoresRes.ok) {
        const scData = await scoresRes.json();
        if (scData.success && Array.isArray(scData.scores)) {
          setScoresCount(scData.scores.length);
        }
      }

      if (guardsRes && guardsRes.ok) {
        const gData = await guardsRes.json();
        if (gData.success && Array.isArray(gData.routes)) {
          setRouteGuards(gData.routes);
        }
      }

    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoadingRedirects(false);
      setLoadingGuards(false);
    }
  };

  const handleToggleLiveTuning = async () => {
    const nextVal = !liveTuningVisible;
    setSavingTuning(true);
    setTuningMsg("");
    try {
      const adminPw = getAdminPassword() || password;
      const response = await fetch("/api/live-tuning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminPw ? { "x-admin-password": adminPw } : {}),
        },
        body: JSON.stringify({ visible: nextVal }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update Slide 3 tuning visibility.");
      setTuningMsg(nextVal ? "✓ Visible on Slide 3" : "✓ Hidden on Slide 3");
      setTimeout(() => setTuningMsg(""), 3000);
    } catch (err) {
      console.error("Failed to update live tuning visibility:", err);
    } finally {
      setSavingTuning(false);
    }
  };

  const handleDeleteSubstrate = async (entry: SubstrateSubmission) => {
    if (!confirm(`Delete ${entry.name}'s substrate response?`)) return;
    setDeletingSubstrate(entry.id);
    setSubstrateError("");
    try {
      await deleteDoc(doc(firestore, SUBSTRATE_COLLECTION, entry.id));
    } catch (error) {
      console.error("Failed to delete substrate response:", error);
      setSubstrateError("Could not delete that Firestore response.");
    } finally {
      setDeletingSubstrate(null);
    }
  };

  const handleClearSubstrates = async () => {
    if (substrateResponses.length === 0) return;
    if (!confirm(`Delete all ${substrateResponses.length} substrate responses?`)) {
      return;
    }

    setDeletingSubstrate("all");
    setSubstrateError("");
    try {
      for (let start = 0; start < substrateResponses.length; start += 500) {
        const batch = writeBatch(firestore);
        substrateResponses.slice(start, start + 500).forEach((entry) => {
          batch.delete(doc(firestore, SUBSTRATE_COLLECTION, entry.id));
        });
        await batch.commit();
      }
    } catch (error) {
      console.error("Failed to clear substrate responses:", error);
      setSubstrateError("Could not clear the Firestore responses.");
    } finally {
      setDeletingSubstrate(null);
    }
  };

  useEffect(() => {
    if (!authed) return;
    const frame = window.requestAnimationFrame(() => {
      void fetchAdminData();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const tuningRef = ref(realtimeDatabase, SUBSTRATE_TUNING_PATH);
    return onValue(tuningRef, (snapshot) => {
      if (!snapshot.exists()) {
        setLiveTuningVisible(false);
        void fetch("/api/live-tuning", { cache: "no-store" });
        return;
      }
      const value = snapshot.val() as { visible?: unknown } | null;
      setLiveTuningVisible(value?.visible === true);
    });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const substrateQuery = query(
      collection(firestore, SUBSTRATE_COLLECTION),
      orderBy("submittedAt", "desc"),
    );
    return onSnapshot(
      substrateQuery,
      (snapshot) => {
        setSubstrateResponses(
          snapshot.docs.map((item) =>
            normalizeSubstrateSubmission(item.id, item.data()),
          ),
        );
        setSubstrateError("");
        setLoadingSubstrates(false);
      },
      (error) => {
        console.error("Failed to load BBDO substrate responses:", error);
        setSubstrateError("Unable to load Firestore responses.");
        setLoadingSubstrates(false);
      },
    );
  }, [authed]);

  // Render QR Code preview on Canvas
  const cleanSlug = qrSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || "live";
  const qrFullUrl = `${hostUrl || "http://localhost:3000"}/r/${cleanSlug}`;

  useEffect(() => {
    if (!canvasRef.current || !authed) return;

    QRCode.toCanvas(
      canvasRef.current,
      qrFullUrl,
      {
        width: 240,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      },
      (err) => {
        if (err) console.error("QR render error:", err);
      }
    );
  }, [qrFullUrl, authed, activeTab]);

  // Auth Submit Handler
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setSigningIn(true);

    try {
      const ok = await login(password);
      if (ok) {
        setSignedIn(true);
        setPassword("");
        return;
      }
      setAuthError("Incorrect admin password.");
    } catch {
      setAuthError("Error signing in.");
    } finally {
      setSigningIn(false);
    }
  }

  function handleLogout() {
    logout();
    setSignedIn(false);
    setPassword("");
    setAuthError("");
  }

  // Create / Save Dynamic QR Code
  async function handleSaveQr(e: FormEvent) {
    e.preventDefault();
    setSavingQr(true);
    setQrSaveMsg(null);

    const adminPw = getAdminPassword();

    try {
      const res = await fetch("/api/redirect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPw,
        },
        body: JSON.stringify({
          slug: cleanSlug,
          url: qrTargetUrl.trim(),
          title: qrTitle.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQrSaveMsg({ type: "success", text: `✓ Dynamic QR (/r/${cleanSlug}) saved successfully!` });
        fetchAdminData();
      } else {
        setQrSaveMsg({ type: "error", text: data.error || "Failed to save QR redirect." });
      }
    } catch {
      setQrSaveMsg({ type: "error", text: "Network error saving QR redirect." });
    } finally {
      setSavingQr(false);
      setTimeout(() => setQrSaveMsg(null), 5000);
    }
  }

  // Quick In-place Edit
  async function handleQuickEditSave(slug: string) {
    if (!editUrl.trim()) return;
    const adminPw = getAdminPassword();

    try {
      const res = await fetch("/api/redirect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPw,
        },
        body: JSON.stringify({
          slug,
          url: editUrl.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingSlug(null);
        fetchAdminData();
      }
    } catch (err) {
      console.error("Failed to update redirect:", err);
    }
  }

  // Delete Dynamic QR Code
  async function handleDeleteRedirect(slug: string) {
    if (!confirm(`Are you sure you want to delete /r/${slug}?`)) return;
    const adminPw = getAdminPassword();

    try {
      const res = await fetch(`/api/redirect?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPw },
      });
      const data = await res.json();
      if (data.success) {
        fetchAdminData();
      }
    } catch (err) {
      console.error("Failed to delete redirect:", err);
    }
  }

  // Update Route Guard Status / Password / Message
  async function handleUpdateRouteGuard(
    id: string,
    status: RouteStatus,
    newPassword?: string,
    disabledMessage?: string
  ) {
    const adminPw = getAdminPassword();

    try {
      const res = await fetch("/api/route-guard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPw,
        },
        body: JSON.stringify({
          id,
          status,
          password: newPassword,
          disabledMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRouteGuards((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  password: newPassword !== undefined ? newPassword : r.password,
                  disabledMessage:
                    disabledMessage !== undefined ? disabledMessage : r.disabledMessage,
                }
              : r
          )
        );

        setGuardSaveMsg({ id, text: `✓ Updated to ${status.toUpperCase()}!` });
        setTimeout(() => setGuardSaveMsg(null), 3000);
      }
    } catch (err) {
      console.error("Failed to update route guard:", err);
    }
  }

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${cleanSlug}.png`;
    a.click();
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    alert(`Copied: ${url}`);
  };

  // Auth Gate
  if (!authed) {
    return (
      <main className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 antialiased">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
              Control Center
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">
              Admin Access Gate
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Authenticate with your environment administrator credentials to access QR management, route protections, and live dashboards.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500 transition font-mono"
              />
            </div>

            {authError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-mono text-red-400">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3.5 text-sm font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              {signingIn ? "Authenticating..." : "Sign In →"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const filteredRedirects = redirects.filter(
    (r) =>
      r.slug.toLowerCase().includes(redirectSearch.toLowerCase()) ||
      r.url.toLowerCase().includes(redirectSearch.toLowerCase()) ||
      (r.title && r.title.toLowerCase().includes(redirectSearch.toLowerCase()))
  );

  const talksGuards = routeGuards.filter((r) => r.category === "talks");
  const expGuards = routeGuards.filter((r) => r.category === "experience");

  const filteredTalks = talksGuards.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTalks.toLowerCase()) ||
      r.path.toLowerCase().includes(searchTalks.toLowerCase())
  );

  const filteredExp = expGuards.filter(
    (r) =>
      r.title.toLowerCase().includes(searchExp.toLowerCase()) ||
      r.path.toLowerCase().includes(searchExp.toLowerCase())
  );

  return (
    <main className="min-h-screen w-full bg-zinc-950 text-white font-sans antialiased p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Control Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                ADMIN CONSOLE ACTIVE
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mt-1">
              Talks & Experiences Control
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Dynamic QR routing, route password protection, route disabling & live experience dashboards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAdminData}
              disabled={loadingRedirects || loadingGuards}
              className="px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-mono font-bold text-zinc-300 hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            >
              {loadingRedirects || loadingGuards ? "Refreshing..." : "↻ Refresh All"}
            </button>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-950/20 text-xs font-mono font-bold text-red-400 hover:bg-red-900/30 transition active:scale-95 cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Tabbed Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "qr"
                ? "bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>📱</span>
            <span>Dynamic QR Codes ({redirects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dash")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "dash"
                ? "bg-amber-500/10 border border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>📊</span>
            <span>Live Dashboards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bbdo")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "bbdo"
                ? "bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>🔴</span>
            <span>BBDO Playday ({substrateResponses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dungeons")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "dungeons"
                ? "bg-orange-500/10 border border-orange-500/40 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>🐉</span>
            <span>Dungeons</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("talks")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "talks"
                ? "bg-purple-500/10 border border-purple-500/40 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>🎙️</span>
            <span>Talks ({talksGuards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("experience")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "experience"
                ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>🎮</span>
            <span>Experiences ({expGuards.length})</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: DYNAMIC QR CODES
           ========================================================================= */}
        {activeTab === "qr" && (
          <div className="space-y-12 animate-in fade-in duration-300">
            {/* Section 1: Generator */}
            <section className="space-y-6">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                  Short Link Routing
                </span>
                <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                  Generate Dynamic QR Codes
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Create and update dynamic `/r/[slug]` redirect links in real-time without re-printing QR graphics.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Form Controls */}
                <form
                  onSubmit={handleSaveQr}
                  className="lg:col-span-7 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        QR Code Title / Campaign Name
                      </label>
                      <input
                        type="text"
                        value={qrTitle}
                        onChange={(e) => setQrTitle(e.target.value)}
                        placeholder="e.g. Aerocano Live Coffee Survey"
                        required
                        className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-cyan-400 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Dynamic Short Slug (/r/...)
                        </label>
                        <div className="flex items-center rounded-xl border border-zinc-700 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-400 focus-within:border-cyan-400">
                          <span>/r/</span>
                          <input
                            type="text"
                            value={qrSlug}
                            onChange={(e) => setQrSlug(e.target.value)}
                            placeholder="live"
                            required
                            className="w-full bg-transparent text-cyan-400 font-bold outline-none pl-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Target Destination URL
                        </label>
                        <input
                          type="text"
                          value={qrTargetUrl}
                          onChange={(e) => setQrTargetUrl(e.target.value)}
                          placeholder="/experience/aerocano-survey"
                          required
                          className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <span className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                        Quick Preset Destinations:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_DESTINATIONS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => {
                              setQrTargetUrl(preset.url);
                              setQrTitle(preset.label);
                            }}
                            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400 hover:border-cyan-500/40 hover:text-cyan-300 transition active:scale-95 cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {qrSaveMsg && (
                    <div
                      className={`rounded-xl border p-3 text-xs font-mono ${
                        qrSaveMsg.type === "success"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-red-500/40 bg-red-500/10 text-red-300"
                      }`}
                    >
                      {qrSaveMsg.text}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingQr}
                      className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-cyan-500/20 hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                    >
                      {savingQr ? "Saving Dynamic QR..." : "Save / Update Dynamic QR →"}
                    </button>
                  </div>
                </form>

                {/* Live QR Preview & Download */}
                <div className="lg:col-span-5 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    Live QR Preview
                  </span>

                  <div className="bg-white p-4 rounded-2xl shadow-inner flex items-center justify-center">
                    <canvas ref={canvasRef} className="max-w-[200px] max-h-[200px]" />
                  </div>

                  <div className="space-y-1 font-mono text-xs w-full px-2">
                    <p className="text-zinc-500 text-[10px]">Destination:</p>
                    <p className="text-cyan-400 font-bold truncate">{qrTargetUrl}</p>
                    <p className="text-zinc-600 text-[10px] truncate">{qrFullUrl}</p>
                  </div>

                  <div className="flex gap-2 w-full pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 py-2 text-xs font-bold text-white hover:bg-zinc-700 transition active:scale-95 cursor-pointer"
                    >
                      ⬇ Download PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(qrFullUrl)}
                      className="px-3 rounded-xl border border-zinc-700 bg-zinc-800/80 text-xs font-bold text-white hover:bg-zinc-700 transition active:scale-95 cursor-pointer"
                    >
                      📋 Copy URL
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* Section 2: List All Generated Dynamic QR Codes */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                    Directory
                  </span>
                  <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                    All Generated Dynamic QR Codes ({redirects.length})
                  </h2>
                </div>

                <input
                  type="text"
                  placeholder="Search by slug, title, or target..."
                  value={redirectSearch}
                  onChange={(e) => setRedirectSearch(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 w-full sm:w-72 font-mono"
                />
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md overflow-hidden shadow-2xl">
                {loadingRedirects ? (
                  <div className="text-center py-12 text-xs font-mono text-zinc-500">
                    Loading dynamic QR codes...
                  </div>
                ) : filteredRedirects.length === 0 ? (
                  <div className="text-center py-12 text-xs font-mono text-zinc-500">
                    No matching dynamic QR codes found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider font-mono text-[10px]">
                          <th className="text-left px-4 py-3">Campaign / Title</th>
                          <th className="text-left px-4 py-3">Dynamic Route</th>
                          <th className="text-left px-4 py-3">Redirect Target</th>
                          <th className="text-right px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRedirects.map((item) => {
                          const isEditing = editingSlug === item.slug;

                          return (
                            <tr
                              key={item.slug}
                              className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-900/40 transition"
                            >
                              <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                                {item.title || item.slug.toUpperCase()}
                              </td>

                              <td className="px-4 py-3.5 font-mono">
                                <span className="inline-flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-bold px-2 py-0.5 rounded-lg">
                                  /r/{item.slug}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 font-mono text-zinc-300">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editUrl}
                                      onChange={(e) => setEditUrl(e.target.value)}
                                      className="rounded-lg border border-cyan-500 bg-black px-2 py-1 text-xs text-white font-mono outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQuickEditSave(item.slug)}
                                      className="px-2 py-1 rounded bg-cyan-500 text-black text-[10px] font-bold"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSlug(null)}
                                      className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-zinc-400 break-all">{item.url}</span>
                                )}
                              </td>

                              <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQrSlug(item.slug);
                                    setQrTargetUrl(item.url);
                                    setQrTitle(item.title || item.slug.toUpperCase());
                                    window.scrollTo({ top: 300, behavior: "smooth" });
                                  }}
                                  className="px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white transition text-[11px] font-mono cursor-pointer"
                                >
                                  QR View
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSlug(item.slug);
                                    setEditUrl(item.url);
                                  }}
                                  className="px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-300 hover:bg-amber-900/30 transition text-[11px] font-mono cursor-pointer"
                                >
                                  Edit Target
                                </button>

                                <a
                                  href={`/r/${item.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-900/30 transition text-[11px] font-mono"
                                >
                                  Test ↗
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteRedirect(item.slug)}
                                  className="px-2 py-1 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/30 transition text-[11px] font-mono cursor-pointer"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 2: LIVE DASHBOARDS
           ========================================================================= */}
        {activeTab === "dash" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
                Real-Time Telemetry
              </span>
              <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                Live Dashboard Experience
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Aerocano Live Experience Card */}
              <Link
                href="/admin/live-dash/aerocano"
                className="group relative flex flex-col justify-between rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/60 to-zinc-900/20 p-8 backdrop-blur-md shadow-xl transition-all hover:border-amber-500/50 hover:shadow-amber-500/10 hover:translate-y-[-2px]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">☕</span>
                      <div>
                        <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition">
                          Aerocano Live Experience
                        </h3>
                        <p className="text-xs font-mono text-zinc-400">/admin/live-dash/aerocano</p>
                      </div>
                    </div>

                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono font-bold text-emerald-400">
                      LIVE
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Interactive real-time data tree, raw audience survey answer submissions, and live shake score leaderboard telemetry.
                  </p>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-zinc-800/80 pt-4">
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-amber-400 font-bold">
                      {surveyCount} <span className="text-zinc-500 font-normal">answers</span>
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-emerald-400 font-bold">
                      {scoresCount} <span className="text-zinc-500 font-normal">shakes</span>
                    </span>
                  </div>

                  <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition">
                    Open Dashboard →
                  </span>
                </div>
              </Link>

              {/* Dragon Slayer Live Card */}
              <Link
                href="/experience/dragon-slayer"
                className="group relative flex flex-col justify-between rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/60 to-zinc-900/20 p-8 backdrop-blur-md shadow-xl transition-all hover:border-cyan-500/50 hover:shadow-cyan-500/10 hover:translate-y-[-2px]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">🐲</span>
                      <div>
                        <h3 className="text-xl font-black text-white group-hover:text-cyan-400 transition">
                          Dragon Slayer Lightsaber
                        </h3>
                        <p className="text-xs font-mono text-zinc-400">/experience/dragon-slayer</p>
                      </div>
                    </div>

                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-mono font-bold text-cyan-400">
                      AI VISION
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Webcam hand and clenched-fist tracking combat arena with Fruit Ninja slashing mechanics, lightsaber plasma synthesis, and 100 HP dragon boss.
                  </p>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-zinc-800/80 pt-4">
                  <span className="text-xs font-mono text-cyan-400 font-bold">
                    Hand-Tracking Engine
                  </span>
                  <span className="text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition">
                    Launch Arena →
                  </span>
                </div>
              </Link>

            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: BBDO AI PLAYDAY
           ========================================================================= */}
        {activeTab === "bbdo" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-400">
                  BBDO AI Playday Activity
                </span>
                <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                  AI Creative Substrates
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
                  View and remove Firestore submissions, open the audience questionnaire, and control the Slide 3 tuning drawer.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/experience/substrate-blob"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20"
                >
                  Open questionnaire ↗
                </a>
                <a
                  href="/talks/bbdo-ai-playday/3"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2 text-xs font-bold text-blue-300 transition hover:bg-blue-500/20"
                >
                  Open Slide 3 ↗
                </a>
              </div>
            </div>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-rose-500/25 bg-rose-950/10 p-5 backdrop-blur-md shadow-xl">
                <div className="flex items-start gap-3.5">
                  <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-2xl">🎛️</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Live tuning panel</h3>
                      <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-rose-300">
                        SLIDE 3
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Show or hide the floating grain controls during the BBDO presentation.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-4">
                  <div>
                    {tuningMsg ? (
                      <span className="text-xs font-mono text-rose-300">{tuningMsg}</span>
                    ) : (
                      <span className="text-xs font-mono text-zinc-500">
                        Synced from Realtime Database
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleLiveTuning}
                      disabled={savingTuning}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
                        liveTuningVisible
                          ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]"
                          : "bg-zinc-700"
                      }`}
                      aria-label="Toggle BBDO Slide 3 live tuning visibility"
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                          liveTuningVisible ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className={`text-xs font-mono font-bold ${liveTuningVisible ? "text-rose-300" : "text-zinc-500"}`}>
                      {liveTuningVisible ? "VISIBLE" : "HIDDEN"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid min-w-52 grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-5">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Responses</p>
                  <p className="mt-1 text-3xl font-black text-white">{substrateResponses.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Storage</p>
                  <p className="mt-2 text-sm font-bold text-amber-300">Firestore</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">Audience submissions</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Question 1 drives red, Question 2 blue, and Question 3 yellow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearSubstrates}
                  disabled={substrateResponses.length === 0 || deletingSubstrate === "all"}
                  className="rounded-xl border border-red-500/30 bg-red-950/20 px-3.5 py-2 text-xs font-bold text-red-300 transition hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingSubstrate === "all" ? "Deleting…" : "Delete all responses"}
                </button>
              </div>

              {substrateError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                  {substrateError}
                </div>
              )}

              <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-2xl">
                {loadingSubstrates ? (
                  <div className="py-14 text-center text-xs font-mono text-zinc-500">
                    Loading Firestore responses…
                  </div>
                ) : substrateResponses.length === 0 ? (
                  <div className="py-14 text-center">
                    <p className="text-sm font-bold text-white">No submissions yet</p>
                    <p className="mt-1 text-xs text-zinc-500">Responses will appear here in real time.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-zinc-800 bg-black/30 font-mono uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-[#FF3154]">Red</th>
                          <th className="px-4 py-3 text-[#6F9AFF]">Blue</th>
                          <th className="px-4 py-3 text-[#FFD23F]">Yellow</th>
                          <th className="px-4 py-3">Submitted</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {substrateResponses.map((entry) => (
                          <tr key={entry.id} className="transition hover:bg-white/[0.025]">
                            <td className="px-4 py-3 font-bold text-white">{entry.name}</td>
                            <td className="px-4 py-3 font-mono text-[#FF6078]">{entry.redScore}/5</td>
                            <td className="px-4 py-3 font-mono text-[#78A1FF]">{entry.blueScore}/5</td>
                            <td className="px-4 py-3 font-mono text-[#FFE27B]">{entry.yellowScore}/5</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-500">
                              {entry.submittedAt
                                ? new Date(entry.submittedAt).toLocaleString()
                                : "Pending…"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteSubstrate(entry)}
                                disabled={deletingSubstrate === entry.id}
                                className="rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1.5 font-mono text-[11px] text-red-300 transition hover:bg-red-900/30 disabled:opacity-40"
                              >
                                {deletingSubstrate === entry.id ? "Deleting…" : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 4: DUNGEONS DATA CONTROL
           ========================================================================= */}
        {activeTab === "dungeons" && <DungeonsAdmin />}

        {/* =========================================================================
            TAB 5: TALKS MANAGEMENT (/talks)
           ========================================================================= */}
        {activeTab === "talks" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400">
                  Presentation Deck Access Control
                </span>
                <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                  Talks & Keynote Decks
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Control accessibility of all `/talks` routes. Protect with custom passcodes or disable access during preparation.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search talks..."
                value={searchTalks}
                onChange={(e) => setSearchTalks(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-purple-400 w-full sm:w-64 font-mono"
              />
            </div>

            {/* List of Talks */}
            <div className="space-y-4">
              {filteredTalks.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  guardSaveMsg={guardSaveMsg?.id === route.id ? guardSaveMsg.text : null}
                  onUpdate={handleUpdateRouteGuard}
                />
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: EXPERIENCE MANAGEMENT (/experience)
           ========================================================================= */}
        {activeTab === "experience" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                  Interactive Lab Access Control
                </span>
                <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                  Interactive Experience Modules
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Control accessibility of all `/experience` routes. Protect with custom passcodes or disable access during testing.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search experiences..."
                value={searchExp}
                onChange={(e) => setSearchExp(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-400 w-full sm:w-64 font-mono"
              />
            </div>

            {/* List of Experiences */}
            <div className="space-y-4">
              {filteredExp.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  guardSaveMsg={guardSaveMsg?.id === route.id ? guardSaveMsg.text : null}
                  onUpdate={handleUpdateRouteGuard}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

// Reusable Route Access Card Component for Talks & Experiences
function RouteCard({
  route,
  guardSaveMsg,
  onUpdate,
}: {
  route: ManagedRoute;
  guardSaveMsg: string | null;
  onUpdate: (id: string, status: RouteStatus, password?: string, disabledMessage?: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<RouteStatus>(route.status);
  const [passcode, setPasscode] = useState(route.password || "");
  const [disabledMsg, setDisabledMsg] = useState(route.disabledMessage || "");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const isMaster = route.id === "all-talks" || route.id === "all-experiences";

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(route.id, status, passcode, disabledMsg);
    setSaving(false);
  };

  return (
    <div
      className={`rounded-3xl border p-6 backdrop-blur-md transition-all shadow-xl ${
        isMaster
          ? "border-amber-500/40 bg-amber-950/10"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Route Info */}
        <div className="space-y-1.5 max-w-lg">
          <div className="flex items-center gap-2.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                status === "public"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : status === "password_protected"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {status === "public" ? "● PUBLIC" : status === "password_protected" ? "🔑 PROTECTED" : "🔒 DISABLED"}
            </span>

            {isMaster && (
              <span className="rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-0.5 text-[10px] font-mono font-bold">
                MASTER SWITCH
              </span>
            )}

            <span className="font-mono text-xs text-zinc-500 font-bold">{route.path}</span>
          </div>

          <h3 className="text-base font-black text-white">{route.title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">{route.description}</p>
        </div>

        {/* Status Switcher Button Group */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus("public")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              status === "public"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            Public
          </button>

          <button
            type="button"
            onClick={() => setStatus("password_protected")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              status === "password_protected"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            🔑 Protect
          </button>

          <button
            type="button"
            onClick={() => setStatus("disabled")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              status === "disabled"
                ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            🔒 Disable
          </button>
        </div>

      </div>

      {/* Extra Configuration Drawer when Protected or Disabled */}
      {(status === "password_protected" || status === "disabled") && (
        <div className="mt-5 pt-4 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
          {status === "password_protected" && (
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-amber-400">
                Route Access Passcode:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode required to view..."
                  className="flex-1 rounded-xl border border-amber-500/40 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none font-mono focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-[11px] font-mono text-zinc-400 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {status === "disabled" && (
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-red-400">
                Custom Disabled Notice:
              </label>
              <input
                type="text"
                value={disabledMsg}
                onChange={(e) => setDisabledMsg(e.target.value)}
                placeholder="e.g. Presentation starting at 2:00 PM..."
                className="w-full rounded-xl border border-red-500/40 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none font-mono focus:border-red-400"
              />
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-zinc-800/40">
        <div className="flex items-center gap-2">
          {guardSaveMsg && (
            <span className="text-xs font-mono font-bold text-emerald-400 animate-pulse">
              {guardSaveMsg}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isMaster && (
            <a
              href={route.path}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400 hover:text-white transition"
            >
              Test Route ↗
            </a>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-mono font-bold hover:bg-zinc-200 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Save Route Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
