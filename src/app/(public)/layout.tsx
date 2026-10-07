import { PublicChrome } from "@/components/SiteChrome";
import { PageView } from "@/components/client";
import { tick } from "@/lib/editorial";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  await tick();
  return (
    <PublicChrome>
      {children}
      <PageView />
    </PublicChrome>
  );
}
