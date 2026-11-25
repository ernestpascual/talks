import { notFound } from "next/navigation";

import SlideContent from "../components/SlideContent";
import SlideNavigation from "../components/SlideNavigation";
import SlidePageNumber from "../components/SlidePageNumber";
import {
  getSlide,
  parseSlideParam,
  slides,
} from "@/lib/talks/bbdo-ai-playday/slides";

type PageProps = {
  params: Promise<{ slide: string }>;
};

export function generateStaticParams() {
  return slides.map(({ number }) => ({ slide: String(number) }));
}

export default async function SlidePage({ params }: PageProps) {
  const { slide: slideParam } = await params;
  const slideNumber = parseSlideParam(slideParam);
  if (slideNumber === null) notFound();

  const slide = getSlide(slideNumber);
  if (!slide) notFound();

  return (
    <div className="relative min-h-[100dvh]">
      <SlideContent slide={slide} />
      <SlidePageNumber current={slideNumber} />
      <SlideNavigation current={slideNumber} />
    </div>
  );
}
