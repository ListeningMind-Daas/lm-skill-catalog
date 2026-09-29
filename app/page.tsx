import Catalog from "@/components/Catalog";
import { Page } from "@/components/ui/AppShell";
import { catalog, toCard, toCardGroup } from "@/lib/catalog";

export default function Home() {
  return (
    <Page>
      <Catalog skills={catalog.skills.map(toCard)} groups={catalog.groups.map(toCardGroup)} bands={catalog.bands} />
    </Page>
  );
}
