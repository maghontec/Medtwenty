import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-serif text-3xl font-bold">
        Med<span className="text-rust">Twenty</span>
      </p>
      <h1 className="mt-6 font-serif text-4xl font-bold">Page not found</h1>
      <p className="mt-3 text-[#3b3e45]">The page may have moved. Try the latest news.</p>
      <Link href="/news" className="btn btn-primary mt-8">Latest news</Link>
    </main>
  );
}
