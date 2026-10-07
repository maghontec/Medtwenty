import { LegalPage, legalMetadata } from "@/components/LegalPage";

export function generateMetadata() {
  return legalMetadata("cookies");
}

export default function Page() {
  return <LegalPage slug="cookies" />;
}
