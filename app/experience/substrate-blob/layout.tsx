import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BBDO AI Creative Substrates",
  description: "Live audience reflection on creating with AI.",
};

export default function SubstrateBlobLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={inter.className}>{children}</div>;
}
