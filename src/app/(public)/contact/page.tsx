import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Contact the MedTwenty editor.", alternates: { canonical: "https://medtwenty.com/contact" } };

export default function ContactPage() {
  return (
    <div className="wrap max-w-[640px] pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold">Contact the editor</h1>
      <p className="mt-3 text-[#3b3e45]">Story tips, corrections, accessibility problems and membership questions.</p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
