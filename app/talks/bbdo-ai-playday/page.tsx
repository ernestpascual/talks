import { redirect } from "next/navigation";
import { TALK_BASE_PATH } from "@/lib/talks/bbdo-ai-playday/slides";

export default function BbdoAiPlaydayIndexPage() {
  redirect(`${TALK_BASE_PATH}/1`);
}
