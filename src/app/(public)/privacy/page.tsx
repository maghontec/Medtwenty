import { LegalPage, legalMetadata } from "@/components/LegalPage";

export function generateMetadata() {
  return legalMetadata("privacy");
}

export default function Page() {
  return <LegalPage slug="privacy" />;
}
