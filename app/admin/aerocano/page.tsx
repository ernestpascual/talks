"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminAerocanoRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/live-dash/aerocano");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500 font-mono text-xs">
      Routing to /admin/live-dash/aerocano...
    </main>
  );
}
