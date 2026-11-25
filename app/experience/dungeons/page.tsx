import Link from "next/link";

import { DungeonShell } from "./components/DungeonUi";

const CHAPTERS = [
  { number: 1, title: "The Sealed Gate", description: "Assemble the party and persuade the old city gate to yield.", background: "/experience/dungeons/city-gate.png" },
  { number: 2, title: "Ashes Remember", description: "Recover the fragments carried home by the surviving adventurers.", background: "/experience/dungeons/ruined-town.png" },
  { number: 3, title: "The Four Elders", description: "Question the last witnesses and uncover the path to battle.", background: "/experience/dungeons/elder-hall.png" },
  { number: 4, title: "Slay the Dragon", description: "Ready every sensor-powered weapon and fight together on the northern mountain.", background: "/experience/dungeons/battle/battlefield.png" },
  { number: 5, title: "The Victory Song", description: "Help the royal bard turn the party's triumph into a living celebration anthem.", background: "/experience/dungeons/battle/battlefield.png" },
] as const;

export default function DungeonsIndexPage() {
  return (
    <DungeonShell background="/experience/dungeons/city-gate.png">
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="dungeon-kicker">A live prompt-driven campaign</p>
          <h1 className="dungeon-title mt-3 text-5xl sm:text-7xl">Welcome to Techeons &amp; Promptons</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#eee2bf]/72 sm:text-lg">
            A party of warriors, mages, and archers must turn good prompts into action, memory, and legend.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CHAPTERS.map((chapter) => (
            <Link
              key={chapter.number}
              href={`/experience/dungeons/${chapter.number}`}
              className="dungeon-panel group overflow-hidden rounded-2xl transition hover:-translate-y-1 hover:border-[#d9bd7d]/70"
            >
              <div className="h-32 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]" style={{ backgroundImage: `url(${chapter.background})` }} />
              <div className="p-5">
                <p className="dungeon-kicker">Chapter {chapter.number}</p>
                <h2 className="mt-2 text-2xl font-bold">{chapter.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">{chapter.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DungeonShell>
  );
}
