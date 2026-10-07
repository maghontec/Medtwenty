import { LegalPage, legalMetadata } from "@/components/LegalPage";

export function generateMetadata() {
  return legalMetadata("accessibility");
}

export default function Page() {
  return <LegalPage slug="accessibility" />;
}
