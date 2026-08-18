import Link from "next/link";

export default function TalkPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Talk</h1>
      <ul className="mt-6 flex flex-col gap-3">
        <li>
          <Link
            href="/talks/bbdo-ai-playday/1"
            className="text-lg font-light text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            BBDO AI Playday
          </Link>
        </li>
        <li>
          <Link
            href="/talks/raw-school-2026/1"
            className="text-lg font-light text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Raw School 2026
          </Link>
        </li>
        <li>
          <Link
            href="/talks/aerocano/1"
            className="text-lg font-light text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Aerocano
          </Link>
        </li>
      </ul>
    </main>
  );
}
