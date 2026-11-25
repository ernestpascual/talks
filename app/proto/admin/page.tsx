"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface TerminalLine {
  id: string;
  type: "system" | "input" | "output" | "error" | "success";
  text: string;
}

const CONTROL_NAMES = ["sword", "staff", "hold", "arrow"] as const;

function resolveControlRoute(command: string) {
  const cleaned = command
    .trim()
    .toLowerCase()
    .replace(/^(cd|goto|open|cat|run|exec|nav|start)\s+/i, "")
    .trim()
    .replace(/^\/proto\//, "")
    .replace(/-control$/, "");

  if (CONTROL_NAMES.includes(cleaned as (typeof CONTROL_NAMES)[number])) {
    return `/proto/${cleaned}-control`;
  }

  return null;
}

export default function PrototypeAdminConsolePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: "motd-1", type: "system", text: "TALKS TTY1 /proto/admin console login: admin" },
  ]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [lines]);

  function appendLine(type: TerminalLine["type"], text: string) {
    setLines((current) => [...current, { id: `${type}-${Date.now()}-${Math.random()}`, type, text }]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (isNavigating) return;

    if (event.key === "Enter") {
      const raw = inputValue.trim();
      if (!raw) return;

      setHistory((current) => [...current, raw]);
      setHistoryIndex(-1);
      setInputValue("");
      appendLine("input", raw);
      const lower = raw.toLowerCase();

      if (lower === "clear" || lower === "cls") {
        setLines([]);
        return;
      }

      if (lower === "help") {
        appendLine("output", "Controls:\n  sword          Open /proto/sword-control\n  staff          Open /proto/staff-control\n  hold           Open /proto/hold-control\n  arrow          Open /proto/arrow-control\n\nCommands:\n  ls             List control names\n  clear          Clear terminal\n  whoami         Show current identity\n  date           Show current time\n  back / exit    Return to /proto");
        return;
      }

      if (lower === "ls" || lower === "list") {
        appendLine("output", CONTROL_NAMES.join("  "));
        return;
      }

      if (lower === "whoami") {
        appendLine("output", "admin");
        return;
      }

      if (lower === "date") {
        appendLine("output", new Date().toISOString());
        return;
      }

      if (["back", "exit", "..", "proto"].includes(lower)) {
        setIsNavigating(true);
        appendLine("success", "Routing to: /proto...");
        window.setTimeout(() => router.push("/proto"), 150);
        return;
      }

      const route = resolveControlRoute(raw);
      if (!route) {
        appendLine("error", `${raw}: control not found; choose sword, staff, hold, or arrow`);
        return;
      }

      setIsNavigating(true);
      appendLine("success", `Routing to: ${route}...`);
      window.setTimeout(() => router.push(route), 150);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputValue(history[nextIndex] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInputValue("");
      } else {
        setHistoryIndex(nextIndex);
        setInputValue(history[nextIndex] ?? "");
      }
    }
  }

  return (
    <main onClick={() => inputRef.current?.focus()} className="min-h-screen w-full cursor-text select-none overflow-y-auto bg-black p-4 font-mono text-sm leading-relaxed text-[#00ff00] sm:p-6">
      <div className="space-y-1">
        {lines.map((line) => (
          <div key={line.id} className={line.type === "input" ? "flex items-start" : "whitespace-pre-wrap"}>
            {line.type === "input" && <span className="mr-2 whitespace-nowrap">admin@talks:~/proto$</span>}
            <span>{line.text}</span>
          </div>
        ))}
        <div className="flex items-center">
          <span className="mr-2 whitespace-nowrap">admin@talks:~/proto$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isNavigating}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="m-0 flex-1 border-none bg-transparent p-0 font-mono text-sm text-[#00ff00] caret-[#00ff00] outline-none"
          />
        </div>
        <div ref={scrollEndRef} />
      </div>
    </main>
  );
}
