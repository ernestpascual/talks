import type { Metadata } from "next";

import CrowdCamera from "./CrowdCamera";

export const metadata: Metadata = {
  title: "Crowd Test · Prototype Lab",
  description: "Live, on-device person counting with OpenCV low-light enhancement.",
};

export default function CrowdTestPage() {
  return <CrowdCamera />;
}
