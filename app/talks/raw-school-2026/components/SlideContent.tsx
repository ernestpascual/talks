"use client";

import type { Slide } from "@/lib/talks/raw-school-2026/slides";
import slide2Artwork from "../img/slide2.png";
import slide4Artwork from "../img/slide4.png";
import slide5Artwork from "../img/slide5.png";
import slide7Artwork from "../img/slide7.png";
import slide8Artwork from "../img/slide8.png";
import slide10Artwork from "../img/slide10.png";
import krebsQr from "@/app/talks/raw-school-2026/img/krebs.png";
import slide11Artwork from "../img/slide11.png";
import slide12Artwork from "../img/slide12.png";
import slide13Artwork from "../img/slide13.png";
import slide14Artwork from "../img/slide14.png";
import {
  SlideArtworkWithVideo,
  SlideFullscreenArtwork,
} from "./SlideArtwork";
import Slide1Hero from "./Slide1Hero";
import Slide6EyeTrack from "./Slide6EyeTrack";
import Slide9FruitNinja from "./Slide9FruitNinja";
import QrOverlay from "./QrOverlay";

const SLIDE2_BG_VIDEO = "/talks/raw-school-2026/img/slide2bg.mp4";
const SLIDE8_BG_VIDEO = "/talks/raw-school-2026/img/slide8bg.mp4";
const SLIDE13_BG_VIDEO = "/talks/raw-school-2026/img/slide13bg.mp4";
const SLIDE14_BG_VIDEO = "/talks/raw-school-2026/img/slide14bg.mp4";

const ARTWORK_VIDEO_BY_SLIDE = {
  2: { videoSrc: SLIDE2_BG_VIDEO, image: slide2Artwork },
  8: { videoSrc: SLIDE8_BG_VIDEO, image: slide8Artwork },
  13: { videoSrc: SLIDE13_BG_VIDEO, image: slide13Artwork },
  14: { videoSrc: SLIDE14_BG_VIDEO, image: slide14Artwork },
} as const;

const ARTWORK_BY_SLIDE = {
  7: slide7Artwork,
  4: slide4Artwork,
  5: slide5Artwork,
  10: slide10Artwork,
  11: slide11Artwork,
  12: slide12Artwork,
} as const;

const center = "flex min-h-screen items-center justify-center px-16 py-12";

export default function SlideContent({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "hero-image":
      return <Slide1Hero />;

    case "artwork-video": {
      const layers = ARTWORK_VIDEO_BY_SLIDE[slide.number];
      if (!layers) return null;
      return (
        <SlideArtworkWithVideo
          videoSrc={layers.videoSrc}
          image={layers.image}
        />
      );
    }

    case "artwork": {
      const image = ARTWORK_BY_SLIDE[slide.number];
      if (!image) return null;
      if (slide.number === 10) {
        return (
          <>
            <SlideFullscreenArtwork image={image} />
            <QrOverlay image={krebsQr} ariaLabel="Krebs demo QR code" />
          </>
        );
      }
      return <SlideFullscreenArtwork image={image} />;
    }


    case "venn":
      return (
        <div className={`${center} flex-col gap-10`}>
          <div className="relative h-56 w-80 scale-[3] sm:h-64 sm:w-96">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 320 208"
              aria-hidden
            >
              <defs>
                <clipPath id="venn-left-clip">
                  <circle cx="88" cy="104" r="88" />
                </clipPath>
              </defs>
              <circle
                cx="88"
                cy="104"
                r="88"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <circle
                cx="232"
                cy="104"
                r="88"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <circle
                cx="232"
                cy="104"
                r="88"
                fill="white"
                clipPath="url(#venn-left-clip)"
              />
            </svg>
            <div className="absolute left-0 top-1/2 flex h-44 w-44 -translate-y-1/2 items-center justify-center sm:h-52 sm:w-52">
              <span className="text-sm font-medium text-white">CREATIVITY</span>
            </div>
            <div className="absolute right-0 top-1/2 flex h-44 w-44 -translate-y-1/2 items-center justify-center sm:h-52 sm:w-52">
              <span className="text-sm font-medium text-white">TECHNOLOGY</span>
            </div>
          </div>
        </div>
      );

    case "statement-eye":
      return <Slide6EyeTrack />;
    case "fruit-ninja":
      return <Slide9FruitNinja />;

    default:
      return null;
  }
}
