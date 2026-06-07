import Image, { type StaticImageData } from "next/image";

export function SlideArtworkWithVideo({
  videoSrc,
  image,
}: {
  videoSrc: string;
  image: StaticImageData;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 bg-black"
      aria-hidden
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        src={videoSrc}
      />
      <Image
        src={image}
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-contain object-center"
      />
    </div>
  );
}

export function SlideFullscreenArtwork({ image }: { image: StaticImageData }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 bg-black"
      aria-hidden
    >
      <Image
        src={image}
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-contain object-center"
      />
    </div>
  );
}
