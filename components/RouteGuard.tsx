"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

interface RouteGuardProps {
  children: React.ReactNode;
  category?: "talks" | "experience";
}

export default function RouteGuard({ children, category }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<{
    status: "public" | "password_protected" | "disabled";
    hasPassword: boolean;
    title: string;
    disabledMessage?: string;
    id: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/route-guard?path=${encodeURIComponent(pathname)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data.success && data.access) {
          setAccess(data.access);

          // Check if already unlocked in sessionStorage
          const sessionKey = `route_unlocked_${data.access.id}`;
          const masterKey = category === "talks" ? "route_unlocked_all-talks" : "route_unlocked_all-experiences";
          if (
            sessionStorage.getItem(sessionKey) === "true" ||
            sessionStorage.getItem(masterKey) === "true" ||
            sessionStorage.getItem("admin-password") // Admin logged in
          ) {
            setIsUnlocked(true);
          }
        }
      } catch (err) {
        console.error("Route access check failed:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [pathname, category]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/route-guard/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname, password: password.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        if (access?.id) {
          sessionStorage.setItem(`route_unlocked_${access.id}`, "true");
        }
        setIsUnlocked(true);
      } else {
        setError(data.error || "Incorrect password. Access denied.");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  // 1. Loading state (minimal transparent placeholder to prevent layout shift)
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex items-center justify-center font-mono text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Verifying route credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Disabled Route Screen
  if (access?.status === "disabled") {
    return (
      <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 antialiased selection:bg-red-500 selection:text-black">
        <div className="max-w-md w-full rounded-3xl border border-red-500/30 bg-red-950/10 p-8 text-center backdrop-blur-xl shadow-2xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/40 bg-red-950/40 text-2xl text-red-400 shadow-inner">
            🔒
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-400">
              Access Suspended
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {access.title || "Route Disabled"}
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              {access.disabledMessage ||
                "This presentation or experience has been temporarily closed by the administrator."}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition"
            >
              ← Return to Console
            </Link>
            <Link
              href="/admin"
              className="flex-1 rounded-xl bg-red-600/80 py-3 text-xs font-bold text-white hover:bg-red-500 transition"
            >
              Admin Portal →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Password Protected Route Screen
  if (access?.status === "password_protected" && !isUnlocked) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 antialiased selection:bg-amber-500 selection:text-black">
        <div className="max-w-md w-full rounded-3xl border border-amber-500/30 bg-zinc-900/60 p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-950/40 text-xl text-amber-400">
              🔑
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
                Protected Content
              </span>
              <h1 className="text-lg font-black tracking-tight text-white">
                {access.title || "Access Pass Required"}
              </h1>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            This route requires an access pass. Please enter the attendee or presenter password to proceed.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-semibold text-zinc-300 mb-1.5">
                Passcode
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access passcode..."
                required
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-400 font-mono transition"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-mono text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              {verifying ? "Verifying Passcode..." : "Unlock & Proceed →"}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-zinc-800/80">
            <Link
              href="/"
              className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition"
            >
              ← Back to Main Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Public or Unlocked: Render Content
  return <>{children}</>;
}
