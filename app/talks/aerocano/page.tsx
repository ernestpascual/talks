import { redirect } from "next/navigation";
import { TALK_BASE_PATH } from "@/lib/talks/aerocano/slides";

export default function AerocanoIndexPage() {
  redirect(`${TALK_BASE_PATH}/1`);
  return null;
}
