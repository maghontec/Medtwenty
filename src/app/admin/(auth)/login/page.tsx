import { StaffLoginForm } from "@/components/AuthForms";

export default function StaffLogin() {
  return (
    <div className="w-full max-w-sm rounded-lg bg-white p-8">
      <p className="font-serif text-2xl font-bold">
        Med<span className="text-rust">Twenty</span>
      </p>
      <h1 className="eyebrow mb-6 mt-1 text-muted">Control Room</h1>
      <StaffLoginForm />
    </div>
  );
}
