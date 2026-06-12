"use client";

export function SlideCornerLink({ url }: { url: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/70 px-4 py-3 backdrop-blur-md">
      <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
        Link
      </span>
      <span className="mt-1 block font-mono text-sm text-zinc-200">{url}</span>
    </div>
  );
}

export function SlideCornerQr({ url }: { url: string }) {
  return (
    <div className="rounded-[1.75rem] border border-zinc-800 bg-black/70 p-3 backdrop-blur-md shadow-2xl">
      <div className="rounded-[1.25rem] bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=240x240&margin=10&color=000000&bgcolor=ffffff&format=png`}
          alt={`QR code for ${url}`}
          width={120}
          height={120}
          className="h-[120px] w-[120px] object-contain"
        />
      </div>
    </div>
  );
}
