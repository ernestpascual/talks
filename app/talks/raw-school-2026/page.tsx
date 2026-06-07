import { redirect } from "next/navigation";
import { TALK_BASE_PATH } from "@/lib/talks/raw-school-2026/slides";

export default function RawSchool2026IndexPage() {
  redirect(`${TALK_BASE_PATH}/1`);
}
