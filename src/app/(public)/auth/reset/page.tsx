import { ResetForm } from "@/components/AuthForms";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="wrap max-w-md py-14">
      <h1 className="mb-8 font-serif text-4xl font-bold">Choose a new password</h1>
      <ResetForm token={token || ""} />
    </div>
  );
}
