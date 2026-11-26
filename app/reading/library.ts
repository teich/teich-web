import { getImageProps } from "next/image";
import manifest from "@/content/covers.json";
import {
  books,
  shelfOrder,
  slugForBook,
  type Book,
  type ReadingShelf,
} from "@/content/reading-list";

type CoverInfo = { w: number; h: number; color: string; pages?: number };

export type ShelfBook = Book & {
  slug: string;
  /** Position in display order; also the book's texture layer. */
  index: number;
  shortTitle: string;
  subtitle?: string;
  cover?: { src: string; width: number; height: number };
  /** width / height */
  aspect: number;
  /** thickness / width, from the page count */
  thick: number;
  /** jacket colour, sRGB 0..1 */
  color: [number, number, number];
  read: boolean;
  texUrl?: string;
  bigUrl?: string;
};

export type Shelf = {
  name: ReadingShelf;
  id: string;
  numeral: string;
  books: ShelfBook[];
};

const covers = manifest as Record<string, CoverInfo>;
const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
// Cloth colours for books that have no cover image yet.
const cloth = ["#2f4a3c", "#5b2a2a", "#27374f", "#6b5a2e", "#3d3a36", "#4a2f4f"];

const sortTitle = (title: string) => title.replace(/^(the|a|an)\s+/i, "");

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** The URL next/image would serve for a cover at a given width. */
function sized(src: string, width: number, height: number) {
  const { props } = getImageProps({ src, width, height, alt: "" });
  return props.srcSet?.split(", ")[0]?.split(" ")[0] ?? props.src;
}

function prepare(book: Book, index: number): ShelfBook {
  const slug = slugForBook(book);
  const info = covers[slug];
  const [shortTitle, subtitle] = book.title.split(/:\s+/, 2);
  const aspect = info ? info.w / info.h : 2 / 3;
  const src = `/covers/${slug}.jpg`;
  return {
    ...book,
    slug,
    index,
    shortTitle,
    subtitle,
    cover: info ? { src, width: info.w, height: info.h } : undefined,
    aspect,
    thick: Math.min(0.3, Math.max(0.075, 0.045 + ((info?.pages ?? 280) / 300) * 0.085)),
    color: rgb(info?.color ?? cloth[slug.length % cloth.length]),
    read: book.status === "read",
    texUrl: info ? sized(src, 384, Math.round(384 / aspect)) : undefined,
    bigUrl: info ? sized(src, 1080, Math.round(1080 / aspect)) : undefined,
  };
}

let position = 0;
export const shelves: Shelf[] = shelfOrder.map((name, n) => ({
  name,
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  numeral: numerals[n] ?? String(n + 1),
  books: books
    .filter((book) => book.shelf === name)
    .sort((a, b) =>
      a.status === b.status
        ? sortTitle(a.title).localeCompare(sortTitle(b.title))
        : a.status === "read"
          ? -1
          : 1,
    )
    .map((book) => prepare(book, position++)),
}));

export const library: ShelfBook[] = shelves.flatMap((shelf) => shelf.books);

export function formatDateRead(dateRead: string) {
  const [year, month, day] = dateRead.split("-").map(Number);
  if (!year) return dateRead;
  if (!month) return String(year);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    ...(day ? { day: "numeric" } : {}),
    year: "numeric",
  }).format(new Date(year, month - 1, day || 1));
}
