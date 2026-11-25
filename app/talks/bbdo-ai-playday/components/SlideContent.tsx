"use client";

import type { Slide } from "@/lib/talks/bbdo-ai-playday/slides";
import slide5Artwork from "../img/slide5.png";
import slide8Artwork from "../img/slide8.png";
import slide10Artwork from "../img/slide10.png";
import creativeSubstrate0 from "../img/creative-substrate/new-0.png";
import creativeSubstrate1 from "../img/creative-substrate/new-1.png";
import creativeSubstrate2 from "../img/creative-substrate/new-2.png";
import creativeSubstrate3 from "../img/creative-substrate/new-3.png";
import creativeSubstrate4 from "../img/creative-substrate/new-4.png";
import creativeSubstrate5 from "../img/creative-substrate/new-5.png";
import processing1 from "../img/processing/proc-1.png";
import processing2 from "../img/processing/proc-2.png";
import processing3 from "../img/processing/proc-3.png";
import processing4 from "../img/processing/proc-4.png";
import processing5 from "../img/processing/proc-5.png";
import {
  SlideArtworkWithVideo,
  SlideFullscreenArtwork,
} from "./SlideArtwork";
import Slide1Hero from "./Slide1Hero";
import Slide2LiquidEther from "./Slide2LiquidEther";
import Slide3LiquidOrbs from "./Slide3LiquidOrbs";
import SlideDmapBattle from "./SlideDmapBattle";
import SlideIceBreakers from "./SlideIceBreakers";
import SlideVideoGrid from "./SlideVideoGrid";

const SLIDE8_BG_VIDEO = "/talks/bbdo-ai-playday/img/slide8bg.mp4";
const SLIDE14_BG_VIDEO = "/talks/bbdo-ai-playday/img/slide14bg.mp4";
const FIN_BG_VIDEO = "/talks/bbdo-ai-playday/img/fin.mp4";

const ARTWORK_VIDEO_BY_SLIDE = {
  12: { videoSrc: SLIDE8_BG_VIDEO, image: slide8Artwork },
  13: { videoSrc: SLIDE14_BG_VIDEO },
  22: { videoSrc: FIN_BG_VIDEO },
} as const;

const ARTWORK_BY_SLIDE = {
  5: slide5Artwork,
  6: slide10Artwork,
} as const;

const CREATIVE_SUBSTRATE_BY_SLIDE = {
  4: creativeSubstrate0,
  7: creativeSubstrate1,
  8: creativeSubstrate2,
  9: creativeSubstrate3,
  10: creativeSubstrate4,
  11: creativeSubstrate5,
} as const;

const PROCESSING_BY_SLIDE = {
  14: processing1,
  15: processing2,
  16: processing3,
  17: processing4,
  21: processing5,
} as const;

export default function SlideContent({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "hero-image":
      return <Slide1Hero />;

    case "liquid-orbs":
      return <Slide3LiquidOrbs />;

    case "video-grid":
      return <SlideVideoGrid />;

    case "dmap-battle":
      return <SlideDmapBattle />;

    case "ice-breakers":
      return <SlideIceBreakers />;

    case "creative-substrate": {
      const image = CREATIVE_SUBSTRATE_BY_SLIDE[slide.number];
      if (!image) return null;
      return <SlideFullscreenArtwork image={image} />;
    }

    case "processing": {
      const image = PROCESSING_BY_SLIDE[slide.number];
      if (!image) return null;
      return <SlideFullscreenArtwork image={image} />;
    }

    case "artwork-video": {
      const layers = ARTWORK_VIDEO_BY_SLIDE[slide.number];
      if (!layers) return null;
      return <SlideArtworkWithVideo {...layers} />;
    }

    case "artwork": {
      if (slide.number === 2) return <Slide2LiquidEther />;
      const image = ARTWORK_BY_SLIDE[slide.number];
      if (!image) return null;
      return <SlideFullscreenArtwork image={image} />;
    }

    default:
      return null;
  }
}
