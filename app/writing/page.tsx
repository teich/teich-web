import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond, Lora } from "next/font/google";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-writing-display",
});

const bodyFont = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-writing-body",
});

const essays = [
  {
    title: "The Formation of Boys",
    href: "/writing/formation-of-boys",
    description:
      "On boys, formation, masculinity, and the local work of helping boys become men.",
  },
  {
    title: "The Shape of Modern Consciousness",
    href: "/writing/modern-conciousness",
    description:
      "On modernity, perception, myth, and the habits of consciousness our world trains into us.",
  },
];

export const metadata: Metadata = {
  title: "Writing",
  description: "Essays by Oren Teich.",
};

export default function WritingPage() {
  return (
    <main
      className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-[#f4efe5] text-stone-800`}
      style={{ fontFamily: "var(--font-writing-body)" }}
    >
      <header className="border-b border-stone-900/10 bg-[#f8f4eb] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <nav className="mb-12 flex flex-wrap gap-4 text-sm text-stone-600">
            <Link className="hover:text-stone-950" href="/">
              Home
            </Link>
            <Link className="hover:text-stone-950" href="/reading">
              Reading
            </Link>
          </nav>

          <p className="mb-4 text-[0.74rem] font-medium uppercase tracking-[0.32em] text-emerald-900">
            Essays
          </p>
          <h1
            className="max-w-3xl text-5xl font-medium leading-none text-stone-950 sm:text-6xl"
            style={{ fontFamily: "var(--font-writing-display)" }}
          >
            Writing
          </h1>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="border-y border-stone-900/10">
          {essays.map((essay) => (
            <article
              key={essay.href}
              className="grid gap-4 border-b border-stone-900/10 py-7 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <h2
                  className="text-3xl font-medium leading-tight text-stone-950"
                  style={{ fontFamily: "var(--font-writing-display)" }}
                >
                  <Link
                    href={essay.href}
                    className="transition-colors hover:text-emerald-900"
                  >
                    {essay.title}
                  </Link>
                </h2>
                <p className="mt-3 max-w-2xl text-[1rem] leading-7 text-stone-700">
                  {essay.description}
                </p>
              </div>
              <Link
                href={essay.href}
                className="w-fit border-b border-stone-500/30 pb-1 text-sm text-stone-600 transition-colors hover:border-emerald-900 hover:text-emerald-900"
              >
                Read essay
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
