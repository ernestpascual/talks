"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { isAuthenticated, login, logout } from "@/lib/admin-auth";
import Link from "next/link";

function subscribe() {
  return () => {};
}

const MENU = [
  {
    href: "/admin/qr-generator",
    icon: "📱",
    label: "QR Generator",
    desc: "Generate QR codes for any URL",
  },
  {
    href: "/admin/aerocano",
    icon: "☕",
    label: "View Aerocano",
    desc: "Browse all scores & survey responses",
  },
];

export default function AdminPage() {
  const storedAuthed = useSyncExternalStore(
    subscribe,
    isAuthenticated,
    () => false,
  );
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const authed = signedIn ?? storedAuthed;

  function handleSubmit(e: FormEvent) {
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

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Sign in to continue. Sessions last 7 days.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-2xl font-semibold tracking-tight">admin</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Select a section to manage.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                {item.label}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {item.desc}
              </p>
            </div>
            <span className="text-zinc-400 dark:text-zinc-600">→</span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-10 w-fit rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Log out
      </button>
    </main>
  );
}
