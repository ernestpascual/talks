import Link from "next/link";
import { TALK_BASE_PATH } from "@/lib/talks/raw-school-2026/slides";

export default function TalkPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Talk</h1>
      <ul className="mt-6 flex flex-col gap-3">
        <li>
          <Link
            href={`${TALK_BASE_PATH}/1`}
            className="text-lg font-light text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Raw School 2026
          </Link>
        </li>
      </ul>
    </main>
  );
}
