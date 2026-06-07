"use client";

import slide10Artwork from "@/app/talks/raw-school-2026/img/slide10.png";
import { SlideFullscreenArtwork } from "@/app/talks/raw-school-2026/components/SlideArtwork";

export default function RawSchool2026KrebsPage() {
  return (
    <main className="relative min-h-screen bg-black">
      <SlideFullscreenArtwork image={slide10Artwork} />
    </main>
  );
}

