"use client";

import Image, { type StaticImageData } from "next/image";

export default function QrOverlay({
  image,
  ariaLabel,
}: {
  image: StaticImageData;
  ariaLabel: string;
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-6 left-6 z-50"
      aria-hidden
    >
      <Image
        src={image}
        alt={ariaLabel}
        width={140}
        height={140}
        unoptimized
        className="bg-transparent"
        style={{
          filter: "invert(1)",
          mixBlendMode: "screen",
          opacity: 0.98,
        }}
      />
    </div>
  );
}

