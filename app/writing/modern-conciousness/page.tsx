import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import { readingByTitle, slugForBook } from "@/content/reading-list";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-essay-display",
});

const bodyFont = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-essay-body",
});

export const metadata: Metadata = {
  title: "The Shape of Modern Consciousness",
  description:
    "An essay on modernity, perception, myth, and the shape of consciousness.",
};

type EssayBlock =
  | { type: "title"; content: string }
  | { type: "note"; content: string }
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] };

function parseEssay(markdown: string): EssayBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: EssayBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let note: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      content: paragraph.join(" ").trim(),
    });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({
      type: "list",
      items: listItems,
    });
    listItems = [];
  };

  const flushNote = () => {
    if (note.length === 0) {
      return;
    }

    blocks.push({
      type: "note",
      content: note.join(" ").trim(),
    });
    note = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushNote();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      flushNote();
      blocks.push({ type: "title", content: trimmed.slice(2).trim() });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushNote();
      blocks.push({ type: "heading", content: trimmed.slice(3).trim() });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      note.push(trimmed.slice(1).trim());
      continue;
    }

    if (trimmed.startsWith("*")) {
      flushParagraph();
      flushNote();
      if (/^\*[^*]+\*\s+--/.test(trimmed)) {
        listItems.push(trimmed);
      } else {
        listItems.push(trimmed.slice(1).trim());
      }
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushNote();

  return blocks;
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(\*[^*]+\*)/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      const title = token.slice(1, -1);
      const book = readingByTitle.get(title);

      if (book) {
        return (
          <Link
            key={`${token}-${index}`}
            href={`/reading#${slugForBook(book)}`}
            className="font-medium italic text-stone-900 underline decoration-stone-400/50 underline-offset-4 transition-colors hover:text-emerald-900 hover:decoration-emerald-900"
          >
            {title}
          </Link>
        );
      }

      return (
        <em key={`${token}-${index}`} className="font-medium italic text-stone-900">
          {title}
        </em>
      );
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

export default async function EssayPage() {
  const essayPath = path.join(
    process.cwd(),
    "content",
    "essays",
    "the-shape-of-modern-consciousness.md",
  );
  const essay = await readFile(essayPath, "utf8");
  const blocks = parseEssay(essay);
  const title = blocks.find((block) => block.type === "title")?.content ?? "Essay";
  const bodyBlocks = blocks.filter((block) => block.type !== "title");
  let leadRendered = false;

  return (
    <main
      className={`${displayFont.variable} ${bodyFont.variable} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f6f0e5_0%,#efe6d7_35%,#ddd0ba_100%)] text-stone-800`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-[rgba(120,93,55,0.09)] blur-3xl" />

      <article className="relative mx-auto flex min-h-screen max-w-4xl items-start px-5 py-10 sm:px-8 sm:py-16 lg:px-10">
        <div className="w-full rounded-[2rem] border border-stone-700/10 bg-[rgba(252,248,240,0.86)] px-6 py-10 shadow-[0_30px_80px_rgba(78,55,27,0.15)] backdrop-blur sm:px-10 sm:py-14 lg:px-16 lg:py-20">
          <header className="mx-auto mb-12 max-w-3xl border-b border-stone-700/10 pb-10 text-center">
            <p className="mb-4 text-[0.72rem] uppercase tracking-[0.38em] text-stone-500">
              Writing
            </p>
            <h1
              className="mx-auto max-w-3xl text-5xl leading-none font-medium text-stone-900 sm:text-6xl"
              style={{ fontFamily: "var(--font-essay-display)" }}
            >
              {title}
            </h1>
            <p className="mt-6 text-sm tracking-[0.18em] text-stone-500 uppercase">
              Oren Teich
            </p>
          </header>

          <div
            className="mx-auto max-w-3xl"
            style={{ fontFamily: "var(--font-essay-body)" }}
          >
            {bodyBlocks.map((block, index) => {
              if (block.type === "heading") {
                return (
                  <section key={`${block.type}-${index}`} className="mt-16">
                    <h2
                      className="text-3xl leading-tight font-medium text-stone-900 sm:text-4xl"
                      style={{ fontFamily: "var(--font-essay-display)" }}
                    >
                      {block.content}
                    </h2>
                  </section>
                );
              }

              if (block.type === "note") {
                return (
                  <aside
                    key={`${block.type}-${index}`}
                    className="mb-10 rounded-[1.5rem] border border-stone-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(245,238,228,0.88))] px-6 py-6 text-stone-700 shadow-[0_18px_40px_rgba(78,55,27,0.08)] sm:px-8"
                  >
                    <p className="mb-3 text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">
                      Author&apos;s Note
                    </p>
                    <p className="text-[1rem] leading-8 sm:text-[1.05rem]">
                      {renderInlineMarkdown(block.content)}
                    </p>
                  </aside>
                );
              }

              if (block.type === "list") {
                return (
                  <ul
                    key={`${block.type}-${index}`}
                    className="mt-8 rounded-[1.75rem] border border-stone-700/10 bg-[rgba(255,255,255,0.52)] px-6 py-4 text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-8"
                  >
                    {block.items.map((item, itemIndex) => (
                      <li
                        key={`${item}-${itemIndex}`}
                        className="grid gap-2 border-b border-stone-700/10 py-5 last:border-b-0"
                      >
                        <span className="text-[0.72rem] uppercase tracking-[0.28em] text-stone-400">
                          {String(itemIndex + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[1.04rem] leading-8 sm:text-[1.08rem]">
                          {renderInlineMarkdown(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              }

              if (block.type === "paragraph") {
                const isLead = !leadRendered;
                leadRendered = true;

                return (
                  <p
                    key={`${block.type}-${index}`}
                    className={
                      isLead
                        ? "text-[1.34rem] leading-9 text-stone-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] sm:text-[1.5rem] sm:leading-10"
                        : "mt-8 text-[1.08rem] leading-8 text-stone-700 sm:text-[1.14rem] sm:leading-9"
                    }
                  >
                    {renderInlineMarkdown(block.content)}
                  </p>
                );
              }

              return null;
            })}
          </div>
        </div>
      </article>
    </main>
  );
}
