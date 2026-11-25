const VIDEOS = [
  {
    label: "Mentor",
    src: "/talks/bbdo-ai-playday/img/DMAP_EXP_090726_MENTOR.mp4",
  },
  {
    label: "Young Lotus",
    src: "/talks/bbdo-ai-playday/img/DMAP_EXP_090726_YOUNG_LOTUS.mp4",
  },
  {
    label: "Young Vidcon",
    src: "/talks/bbdo-ai-playday/img/DMAP_EXP_090726_YoungVidcon.mp4",
  },
] as const;

export default function SlideVideoGrid() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black px-12 py-16 sm:px-16">
      <div className="grid w-full max-w-[1500px] grid-cols-3 items-center gap-3 sm:gap-6 lg:gap-10">
        {VIDEOS.map((video) => (
          <figure key={video.src} className="min-w-0">
            <video
              className="aspect-[1206/2622] w-full rounded-sm bg-zinc-950 object-contain shadow-2xl"
              controls
              playsInline
              preload="metadata"
              src={video.src}
            >
              Your browser does not support the video tag.
            </video>
            <figcaption className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-white/70 sm:text-xs">
              {video.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
