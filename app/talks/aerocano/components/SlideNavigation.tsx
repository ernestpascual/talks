"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SLIDE_COUNT, TALK_BASE_PATH } from "@/lib/talks/aerocano/slides";

type SlideNavigationProps = {
  current: number;
};

function ChevronLeft() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// Custom right chevron
function ChevronRight() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const arrowClass =
  "fixed top-1/2 z-50 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

export default function SlideNavigation({ current }: SlideNavigationProps) {
  const router = useRouter();
  const isFirst = current === 1;
  const isLast = current === SLIDE_COUNT;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowLeft" && !isFirst) {
        event.preventDefault();
        router.push(`${TALK_BASE_PATH}/${current - 1}`);
      } else if (event.key === "ArrowRight" && !isLast) {
        event.preventDefault();
        router.push(`${TALK_BASE_PATH}/${current + 1}`);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, isFirst, isLast, router]);

  return (
    <>
      {!isFirst ? (
        <Link
          href={`${TALK_BASE_PATH}/${current - 1}`}
          className={`${arrowClass} left-4`}
          aria-label="Previous slide"
        >
          <ChevronLeft />
        </Link>
      ) : null}
      {!isLast ? (
        <Link
          href={`${TALK_BASE_PATH}/${current + 1}`}
          className={`${arrowClass} right-4`}
          aria-label="Next slide"
        >
          <ChevronRight />
        </Link>
      ) : null}
    </>
  );
}
