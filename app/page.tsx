"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface TerminalLine {
  id: string;
  type: "system" | "input" | "output" | "error" | "success";
  text: string;
}

function resolveRoute(cmd: string): string | null {
  const trimmed = cmd.trim().toLowerCase();
  if (!trimmed) return null;

  const cleanCmd = trimmed.replace(/^(cd|goto|open|cat|run|exec|nav|start)\s+/i, "").trim();

  if (cleanCmd.startsWith("/")) {
    return cleanCmd;
  }

  const aliasMap: Record<string, string> = {
    "experience": "/experience",
    "experiences": "/experience",
    "dragon": "/experience/dragon-slayer",
    "dragon-slayer": "/experience/dragon-slayer",
    "slayer": "/experience/dragon-slayer",
    "lightsaber": "/experience/dragon-slayer",
    "officemate": "/experience/find-your-officemate",
    "find-your-officemate": "/experience/find-your-officemate",
    "radar": "/experience/find-your-officemate",
    "bluetooth": "/experience/find-your-officemate",
    "shake": "/experience/aerocano-shake",
    "aerocano-shake": "/experience/aerocano-shake",
    "survey": "/experience/aerocano-survey",
    "aerocano-survey": "/experience/aerocano-survey",
    "talks": "/talks",
    "talk": "/talk",
    "aerocano": "/talks/aerocano",
    "bbdo": "/talks/bbdo-ai-playday",
    "bbdo-ai-playday": "/talks/bbdo-ai-playday",
    "raw": "/talks/raw-school-2026",
    "raw-school": "/talks/raw-school-2026",
    "raw-school-2026": "/talks/raw-school-2026",
    "admin": "/admin",
    "admin/aerocano": "/admin/aerocano",
    "admin/qr": "/admin/qr-generator",
    "qr": "/admin/qr-generator",
    "lyria": "/proto/lyria",
    "google-lyria": "/proto/lyria",
    "music": "/proto/lyria",
  };

  if (aliasMap[cleanCmd]) {
    return aliasMap[cleanCmd];
  }

  return `/${cleanCmd}`;
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const [inputVal, setInputVal] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "motd-1",
      type: "system",
      text: "TALKS TTY1 console login: guest",
    },
    {
      id: "motd-2",
      type: "system",
      text: "Last login: Wed Aug 19 01:00:00 on tty1",
    },
  ]);

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [lines]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isNavigating) return;

    if (e.key === "Enter") {
      const raw = inputVal.trim();
      if (!raw) return;

      setCmdHistory((prev) => [...prev, raw]);
      setHistoryIndex(-1);
      setInputVal("");

      const inputLineId = `line-${Date.now()}`;
      setLines((prev) => [
        ...prev,
        { id: inputLineId, type: "input", text: raw },
      ]);

      const lower = raw.toLowerCase().trim();

      if (lower === "clear" || lower === "cls") {
        setLines([]);
        return;
      }

      if (lower === "help") {
        setLines((prev) => [
          ...prev,
          {
            id: `help-${Date.now()}`,
            type: "output",
            text: "Commands:\n  <route>        Navigate directly to route\n  clear          Clear terminal\n  whoami         Show current user identity",
          },
        ]);
        return;
      }

      if (lower === "whoami") {
        setLines((prev) => [
          ...prev,
          {
            id: `whoami-${Date.now()}`,
            type: "output",
            text: "guest",
          },
        ]);
        return;
      }

      if (lower === "date") {
        setLines((prev) => [
          ...prev,
          {
            id: `date-${Date.now()}`,
            type: "output",
            text: new Date().toISOString(),
          },
        ]);
        return;
      }

      const targetRoute = resolveRoute(raw);

      if (targetRoute) {
        setIsNavigating(true);
        setLines((prev) => [
          ...prev,
          {
            id: `exec-${Date.now()}`,
            type: "success",
            text: `Routing to: ${targetRoute}...`,
          },
        ]);

        setTimeout(() => {
          router.push(targetRoute);
        }, 150);
      } else {
        setLines((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: `${raw}: command or route not found`,
          },
        ]);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx =
        historyIndex === -1 ? cmdHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(cmdHistory[nextIdx] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= cmdHistory.length) {
        setHistoryIndex(-1);
        setInputVal("");
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(cmdHistory[nextIdx] ?? "");
      }
    }
  };

  return (
    <main
      onClick={handleContainerClick}
      className="min-h-screen w-full bg-black text-[#00ff00] font-mono text-sm leading-relaxed p-4 sm:p-6 select-none cursor-text overflow-y-auto"
    >
      <div className="space-y-1">
        {lines.map((line) => {
          if (line.type === "input") {
            return (
              <div key={line.id} className="flex items-start">
                <span className="text-[#00ff00] mr-2">guest@talks:~$</span>
                <span className="text-[#00ff00]">{line.text}</span>
              </div>
            );
          }

          if (line.type === "error") {
            return (
              <div key={line.id} className="text-[#00ff00]">
                {line.text}
              </div>
            );
          }

          if (line.type === "success") {
            return (
              <div key={line.id} className="text-[#00ff00]">
                {line.text}
              </div>
            );
          }

          return (
            <div key={line.id} className="whitespace-pre-wrap text-[#00ff00]">
              {line.text}
            </div>
          );
        })}

        {/* Active Command Line */}
        <div className="flex items-center">
          <span className="text-[#00ff00] mr-2 whitespace-nowrap">guest@talks:~$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isNavigating}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="flex-1 bg-transparent text-[#00ff00] font-mono text-sm outline-none border-none caret-[#00ff00] p-0 m-0"
          />
        </div>

        <div ref={scrollEndRef} />
      </div>
    </main>
  );
}
