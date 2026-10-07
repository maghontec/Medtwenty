import { ForgotForm } from "@/components/AuthForms";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="wrap max-w-md py-14">
      <h1 className="mb-8 font-serif text-4xl font-bold">Reset your password</h1>
      <ForgotForm />
    </div>
  );
}
