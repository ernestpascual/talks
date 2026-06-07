import Image from "next/image";
import slide1Background from "../img/slide1.png";

const SLIDE1_BG_VIDEO = "/talks/raw-school-2026/img/slide1bg.mp4";

export default function Slide1Hero() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-black" aria-hidden>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        src={SLIDE1_BG_VIDEO}
      />
      <Image
        src={slide1Background}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-contain object-center"
      />
    </div>
  );
}
