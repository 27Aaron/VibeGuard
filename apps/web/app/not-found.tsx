import { NotFoundContent } from "@/components/not-found-content";
import { getRequestLang } from "@/lib/request-lang";

export default async function NotFound() {
  const lang = await getRequestLang();

  return <NotFoundContent lang={lang} />;
}
