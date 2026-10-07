import Link from "next/link";
import { SignupForm } from "@/components/AuthForms";

export const metadata = { title: "Create free account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams;
  return (
    <div className="wrap max-w-md py-14">
      <h1 className="font-serif text-4xl font-bold">Create a free account</h1>
      <ul className="mb-8 mt-4 space-y-1 text-[#3b3e45]">
        <li>· Three Premium articles a month</li>
        <li>· Follow up to three companies</li>
        <li>· The Daily Story and The MedTwenty Weekly by email</li>
      </ul>
      <SignupForm redirectTo={redirect} />
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} className="font-semibold text-rust-text underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
