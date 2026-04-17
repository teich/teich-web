"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  books,
  bookshopSearchUrl,
  shelfOrder,
  slugForBook,
  type Book,
  type ReadingShelf,
} from "@/content/reading-list";

type ReadingFilter = "all" | "read" | "to-read";

const filters: {
  key: ReadingFilter;
  label: string;
  count: number;
}[] = [
  {
    key: "all",
    label: "All",
    count: books.length,
  },
  {
    key: "read",
    label: "Read",
    count: books.filter((book) => book.status === "read").length,
  },
  {
    key: "to-read",
    label: "To read",
    count: books.filter((book) => book.status === "to-read").length,
  },
];

function shelfId(shelf: ReadingShelf) {
  return shelf.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function StatusBadge({ status }: { status: Book["status"] }) {
  const label = status === "read" ? "Read" : "To read";

  return (
    <span className="inline-flex w-fit items-center border border-stone-700/15 bg-white/70 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-stone-600">
      {label}
    </span>
  );
}

function FilterButton({
  count,
  isActive,
  label,
  onClick,
}: {
  count: number;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`border-r border-stone-900/10 p-4 text-center transition-colors last:border-r-0 sm:p-5 ${
        isActive
          ? "bg-emerald-900 text-white"
          : "bg-white/60 text-stone-950 hover:bg-white"
      }`}
    >
      <span className="block text-3xl">{count}</span>
      <span
        className={`mt-1 block text-[0.68rem] uppercase tracking-[0.18em] ${
          isActive ? "text-emerald-50" : "text-stone-500"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <article
      id={slugForBook(book)}
      className="scroll-mt-8 border border-stone-800/10 bg-[#fffdf8] p-5 shadow-[0_12px_30px_rgba(57,43,24,0.08)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h3
            className="text-2xl font-medium leading-tight text-stone-950"
            style={{ fontFamily: "var(--font-reading-display)" }}
          >
            {book.title}
          </h3>
          <p className="mt-1 text-sm text-stone-600">{book.author}</p>
        </div>
        <div className="flex justify-end">
          <StatusBadge status={book.status} />
        </div>
      </div>

      {book.note ? (
        <p className="mt-4 text-[0.98rem] leading-7 text-stone-700">{book.note}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <a
          href={bookshopSearchUrl(book)}
          className="border-b border-emerald-800/30 pb-0.5 font-medium text-emerald-900 transition-colors hover:border-emerald-900"
        >
          Find on Bookshop.org
        </a>
        {book.mentionedIn?.map((mention) => (
          <Link
            key={mention.href}
            href={mention.href}
            className="border-b border-stone-500/30 pb-0.5 text-stone-600 transition-colors hover:border-stone-800 hover:text-stone-900"
          >
            Mentioned in {mention.title}
          </Link>
        ))}
      </div>
    </article>
  );
}

function filterBook(book: Book, filter: ReadingFilter) {
  if (filter === "read") {
    return book.status === "read";
  }

  if (filter === "to-read") {
    return book.status === "to-read";
  }

  return true;
}

function sortBooks(left: Book, right: Book) {
  if (left.status !== right.status) {
    return left.status === "read" ? -1 : 1;
  }

  return left.title.localeCompare(right.title);
}

export default function ReadingList() {
  const [activeFilter, setActiveFilter] = useState<ReadingFilter>("all");
  const filteredBooks = useMemo(
    () => books.filter((book) => filterBook(book, activeFilter)),
    [activeFilter],
  );
  const visibleShelves = shelfOrder
    .map((shelf) => ({
      shelf,
      books: filteredBooks.filter((book) => book.shelf === shelf).sort(sortBooks),
    }))
    .filter((group) => group.books.length > 0);

  return (
    <>
      <header className="border-b border-stone-900/10 bg-[#f8f4eb] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <nav className="mb-12 flex flex-wrap gap-4 text-sm text-stone-600">
            <Link className="hover:text-stone-950" href="/">
              Home
            </Link>
            <Link className="hover:text-stone-950" href="/writing/modern-conciousness">
              Modern Consciousness
            </Link>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-end">
            <div>
              <p className="mb-4 text-[0.74rem] font-medium uppercase tracking-[0.32em] text-emerald-900">
                Reading
              </p>
              <h1
                className="max-w-3xl text-5xl font-medium leading-none text-stone-950 sm:text-6xl"
                style={{ fontFamily: "var(--font-reading-display)" }}
              >
                Reading List
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
                Books I have read, books I love, and books I want close at hand for
                future reading and references.
              </p>
            </div>

            <div className="grid grid-cols-3 border border-stone-900/10">
              {filters.map((filter) => (
                <FilterButton
                  key={filter.key}
                  count={filter.count}
                  isActive={activeFilter === filter.key}
                  label={filter.label}
                  onClick={() => setActiveFilter(filter.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="mb-10 flex flex-wrap gap-3 text-sm">
          {visibleShelves.map(({ shelf }) => (
            <a
              key={shelf}
              href={`#${shelfId(shelf)}`}
              className="border border-stone-800/10 bg-white/60 px-3 py-2 text-stone-700 hover:bg-white"
            >
              {shelf}
            </a>
          ))}
        </div>

        <div className="space-y-16">
          {visibleShelves.map(({ shelf, books: shelfBooks }) => (
            <section key={shelf} id={shelfId(shelf)} className="scroll-mt-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-stone-900/10 pb-4">
                <h2
                  className="text-3xl font-medium leading-tight text-stone-950 sm:text-4xl"
                  style={{ fontFamily: "var(--font-reading-display)" }}
                >
                  {shelf}
                </h2>
                <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
                  {shelfBooks.length} books
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {shelfBooks.map((book) => (
                  <BookCard key={`${book.title}-${book.author}`} book={book} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
