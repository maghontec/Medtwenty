import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams;
  return (
    <div className="wrap max-w-md py-14">
      <h1 className="font-serif text-4xl font-bold">Sign in</h1>
      <p className="mb-8 mt-2 text-[#3b3e45]">
        New to MedTwenty?{" "}
        <Link href={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} className="font-semibold text-rust-text underline">
          Create a free account
        </Link>
      </p>
      <LoginForm redirectTo={redirect} />
    </div>
  );
}
