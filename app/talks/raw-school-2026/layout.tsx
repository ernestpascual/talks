import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export default function RawSchool2026Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.className} min-h-full bg-black text-white`}>
      {children}
    </div>
  );
}
