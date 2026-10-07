import { LegalPage, legalMetadata } from "@/components/LegalPage";

export function generateMetadata() {
  return legalMetadata("terms");
}

export default function Page() {
  return <LegalPage slug="terms" />;
}
