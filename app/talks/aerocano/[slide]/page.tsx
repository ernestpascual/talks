import { notFound } from "next/navigation";
import SlideContent from "../components/SlideContent";
import SlideNavigation from "../components/SlideNavigation";
import SlidePageNumber from "../components/SlidePageNumber";
import {
  SLIDE_COUNT,
  getSlide,
  parseSlideParam,
} from "@/lib/talks/aerocano/slides";

type PageProps = {
  params: Promise<{ slide: string }>;
};

export function generateStaticParams() {
  return Array.from({ length: SLIDE_COUNT }, (_, i) => ({
    slide: String(i + 1),
  }));
}

export default async function SlidePage({ params }: PageProps) {
  const { slide: slideParam } = await params;
  const slideNumber = parseSlideParam(slideParam);
  if (slideNumber === null) notFound();

  const slide = getSlide(slideNumber);
  if (!slide) notFound();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <SlideContent slide={slide} />
      <SlidePageNumber current={slideNumber} />
      <SlideNavigation current={slideNumber} />
    </div>
  );
}
