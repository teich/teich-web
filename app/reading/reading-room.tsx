"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { bookshopSearchUrl } from "@/content/reading-list";
import type { Engine, ViewMode } from "./gpu/engine";
import { formatDateRead, library, shelves, type ShelfBook } from "./library";

type Filter = "all" | "read" | "to-read" | "favorites";
type Order = "shelf" | "recent";
type Gpu = "pending" | "on" | "off";

type DisplayGroup = {
  id: string;
  numeral: string;
  name: string;
  books: ShelfBook[];
};

const favoriteCount = library.filter((b) => b.rating === 5).length;

const filters: { key: Filter; label: string; count: number }[] = [
  { key: "all", label: "All", count: library.length },
  { key: "read", label: "Read", count: library.filter((b) => b.status === "read").length },
  { key: "to-read", label: "To read", count: library.filter((b) => b.status === "to-read").length },
  ...(favoriteCount > 0
    ? [{ key: "favorites" as const, label: "Favorites", count: favoriteCount }]
    : []),
];

const bySlug = new Map(library.map((book) => [book.slug, book]));

function statusLine(book: ShelfBook) {
  if (book.status === "to-read") return "To read";
  return book.dateRead ? `Read ${formatDateRead(book.dateRead)}` : "Read";
}

function dateKey(dateRead?: string) {
  if (!dateRead) return "";
  const [y = "0000", m = "00", d = "00"] = dateRead.split("-");
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function Cover({ book, sizes, view }: { book: ShelfBook; sizes: string; view: ViewMode }) {
  const clothRgb = `rgb(${book.color.map((c) => Math.round(c * 255)).join(" ")})`;
  if (view === "spines") {
    const lum = 0.2126 * book.color[0] + 0.7152 * book.color[1] + 0.0722 * book.color[2];
    const ink = lum > 0.52 ? "rgb(32 27 22 / 0.9)" : "rgb(247 240 224 / 0.94)";
    return (
      <span
        className="spine-fallback"
        style={{ "--cloth": clothRgb, "--spine-ink": ink } as CSSProperties}
      >
        <span>{book.shortTitle}</span>
        <small>{book.author.split(" ").at(-1)}</small>
      </span>
    );
  }
  if (!book.cover) {
    return (
      <span className="cloth" style={{ "--cloth": clothRgb } as CSSProperties}>
        <span>{book.shortTitle}</span>
        <small>{book.author}</small>
      </span>
    );
  }
  return (
    <Image
      src={book.cover.src}
      width={book.cover.width}
      height={book.cover.height}
      sizes={sizes}
      alt=""
    />
  );
}

const engineBooks = library.map((book) => ({
  ...book,
  statusLine: statusLine(book),
}));

export default function ReadingRoom() {
  const [filter, setFilter] = useState<Filter>("all");
  const [orderBy, setOrderBy] = useState<Order>("shelf");
  const [view, setView] = useState<ViewMode>("covers");
  const [query, setQuery] = useState("");
  const [gpu, setGpu] = useState<Gpu>("pending");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [copied, setCopied] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const pushed = useRef(false);
  const returnTo = useRef<string | null>(null);
  const dragFrom = useRef<{ x: number; y: number; moved: number } | null>(null);
  const drifting = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const matchesBook = useCallback(
    (book: ShelfBook) => {
      if (filter === "read" && book.status !== "read") return false;
      if (filter === "to-read" && book.status !== "to-read") return false;
      if (filter === "favorites" && book.rating !== 5) return false;
      if (!normalizedQuery) return true;
      return (
        book.title.toLowerCase().includes(normalizedQuery) ||
        book.author.toLowerCase().includes(normalizedQuery) ||
        book.shelf.toLowerCase().includes(normalizedQuery) ||
        (book.note?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    },
    [filter, normalizedQuery],
  );

  const groups: DisplayGroup[] = useMemo(() => {
    if (orderBy === "shelf") {
      return shelves
        .map((shelf) => ({
          id: shelf.id,
          numeral: shelf.numeral,
          name: shelf.name,
          books: shelf.books.filter(matchesBook),
        }))
        .filter((shelf) => shelf.books.length > 0);
    }

    const filtered = library.filter(matchesBook);
    const dated = filtered
      .filter((b) => Boolean(b.dateRead))
      .sort((a, b) => dateKey(b.dateRead).localeCompare(dateKey(a.dateRead)));
    const undatedRead = filtered.filter((b) => !b.dateRead && b.status === "read");
    const toRead = filtered.filter((b) => !b.dateRead && b.status === "to-read");

    const byYear = new Map<string, ShelfBook[]>();
    for (const book of dated) {
      const year = book.dateRead!.split("-")[0] || "Dated";
      const list = byYear.get(year) ?? [];
      list.push(book);
      byYear.set(year, list);
    }

    const result: DisplayGroup[] = [];
    for (const [year, yearBooks] of byYear) {
      result.push({
        id: `year-${year}`,
        numeral: year,
        name: `Read in ${year}`,
        books: yearBooks,
      });
    }
    if (undatedRead.length > 0) {
      result.push({
        id: "earlier-reads",
        numeral: "—",
        name: "Earlier reads",
        books: undatedRead,
      });
    }
    if (toRead.length > 0) {
      result.push({
        id: "to-read-pile",
        numeral: "○",
        name: "To read",
        books: toRead,
      });
    }
    return result;
  }, [orderBy, matchesBook]);

  const order = useMemo(() => groups.flatMap((group) => group.books), [groups]);
  const selected = selectedSlug ? (bySlug.get(selectedSlug) ?? null) : null;
  const hoveredBook = hoveredSlug ? (bySlug.get(hoveredSlug) ?? null) : null;

  // ── Renderer ───────────────────────────────────────────────────────────
  const measureBox = useCallback(() => {
    const engine = engineRef.current;
    const holder = boxRef.current?.getBoundingClientRect();
    if (!engine || !holder) return;
    engine.setBox({
      x: holder.left + holder.width / 2,
      y: holder.top + holder.height / 2,
      w: holder.width,
      h: holder.height,
    });
  }, []);

  const measure = useCallback(() => {
    const engine = engineRef.current;
    const stage = stageRef.current;
    if (!engine || !stage) return;
    const origin = stage.getBoundingClientRect();
    engine.setSlots(
      library.map((book) => {
        const rect = slotRefs.current.get(book.slug)?.getBoundingClientRect();
        if (!rect?.width) return null;
        return {
          x: rect.left - origin.left + rect.width / 2,
          y: rect.top - origin.top + rect.height / 2,
          w: rect.width,
          h: rect.height,
        };
      }),
    );
    measureBox();
  }, [measureBox]);

  useEffect(() => {
    let dead = false;
    let engine: Engine | null = null;
    (async () => {
      if (!("gpu" in navigator)) return setGpu("off");
      try {
        const { createEngine } = await import("./gpu/engine");
        const main = mainRef.current;
        if (dead || !main || !canvasRef.current || !stageRef.current) return;
        const styles = getComputedStyle(main);
        engine = await createEngine({
          canvas: canvasRef.current,
          stage: stageRef.current,
          books: engineBooks,
          fontFamily: styles.getPropertyValue("--font-reading-display").trim() || "serif",
          bodyFontFamily: styles.getPropertyValue("--font-reading-body").trim() || "Georgia, serif",
          crestUrl: "/teich-crest.jpg",
          onLost: () => {
            engineRef.current = null;
            setGpu("off");
          },
        });
        if (dead) return engine?.destroy();
        if (!engine) return setGpu("off");
        engineRef.current = engine;
        setGpu("on");
      } catch (error) {
        console.warn("Reading list: WebGPU unavailable, using plain covers.", error);
        if (!dead) setGpu("off");
      }
    })();
    return () => {
      dead = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    engineRef.current?.setViewMode(view);
    measure();
    engineRef.current?.setSelected(selected ? selected.index : null);
  }, [measure, gpu, filter, orderBy, view, normalizedQuery, selected]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let queued = 0;
    const queue = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(queue);
    observer.observe(main);
    window.addEventListener("resize", queue);
    document.fonts.ready.then(queue);
    return () => {
      cancelAnimationFrame(queued);
      observer.disconnect();
      window.removeEventListener("resize", queue);
    };
  }, [measure]);

  // ── Which book is open lives in the URL hash ───────────────────────────
  useEffect(() => {
    const sync = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      setSelectedSlug(bySlug.has(slug) ? slug : null);
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const open = useCallback((slug: string, fromShelf = true) => {
    setCopied(false);
    if (pushed.current) {
      window.history.replaceState(null, "", `#${slug}`);
    } else {
      window.history.pushState(null, "", `#${slug}`);
      pushed.current = true;
      returnTo.current = fromShelf ? slug : null;
    }
    setSelectedSlug(slug);
  }, []);

  const close = useCallback(() => {
    setCopied(false);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setSelectedSlug(null);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (!selectedSlug) return;
      setCopied(false);
      const list = order.some((book) => book.slug === selectedSlug) ? order : library;
      const at = list.findIndex((book) => book.slug === selectedSlug);
      const next = list[(at + delta + list.length) % list.length];
      window.history.replaceState(null, "", `#${next.slug}`);
      setSelectedSlug(next.slug);
    },
    [order, selectedSlug],
  );

  const copyLink = useCallback(async () => {
    if (!selected) return;
    const url = `${window.location.origin}${window.location.pathname}#${selected.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: leave URL hash intact.
    }
  }, [selected]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // Keyboard shortcuts: "/" focuses search when browsing; arrows & Esc in detail view.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (selectedSlug) {
        if (event.key === "Escape") close();
        else if (event.key === "ArrowRight") step(1);
        else if (event.key === "ArrowLeft") step(-1);
        return;
      }
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSlug, close, step]);

  const isOpen = selected !== null;
  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus({ preventScroll: true });
    } else if (returnTo.current) {
      slotRefs.current.get(returnTo.current)?.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [isOpen]);

  // ── Pointer ────────────────────────────────────────────────────────────
  const tilt = (book: ShelfBook) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch" || drifting.current !== null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.setHover(
      book.index,
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1,
    );
    if (view === "spines") setHoveredSlug(book.slug);
  };

  const jump = (id: string) => (event: React.MouseEvent) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  };

  const at = selected ? order.findIndex((book) => book.slug === selected.slug) : -1;
  const pager = at >= 0 ? order : library;
  const here = selected ? pager.findIndex((book) => book.slug === selected.slug) : -1;
  const previous = selected ? pager[(here - 1 + pager.length) % pager.length] : null;
  const following = selected ? pager[(here + 1) % pager.length] : null;

  return (
    <main
      ref={mainRef}
      className="reading"
      data-gpu={gpu}
      data-view={view}
      data-detail={isOpen ? "" : undefined}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        engineRef.current?.setPointer(event.clientX, event.clientY);
      }}
      onPointerLeave={() => {
        engineRef.current?.setPointer(null, null);
      }}
    >
      <div
        className="page"
        inert={isOpen}
        // Books drifting in the stream are drawn over the page, so they are
        // picked by position rather than by element.
        onClickCapture={(event) => {
          const hit = engineRef.current?.pick(event.clientX, event.clientY) ?? null;
          if (hit === null) return;
          event.preventDefault();
          event.stopPropagation();
          drifting.current = null;
          event.currentTarget.removeAttribute("data-pick");
          engineRef.current?.setHover(null);
          open(library[hit].slug, false);
        }}
        onPointerMoveCapture={(event) => {
          if (event.pointerType === "touch") return;
          const hit = engineRef.current?.pick(event.clientX, event.clientY) ?? null;
          if (hit === drifting.current) return;
          drifting.current = hit;
          event.currentTarget.toggleAttribute("data-pick", hit !== null);
          engineRef.current?.setHover(hit);
        }}
        onPointerLeave={(event) => {
          drifting.current = null;
          event.currentTarget.removeAttribute("data-pick");
          engineRef.current?.setHover(null);
          setHoveredSlug(null);
        }}
      >
        <nav className="masthead" aria-label="Site">
          <Link href="/">Teich</Link>
          <Link href="/writing">Writing</Link>
        </nav>

        <header className="hero" data-hero>
          <h1>Reading</h1>
          <p className="lede">
            The books I've read that left an impact, and the to-read pile that will.
          </p>
        </header>

        <section className="contents" aria-label="Contents">
          <div className="controls">
            <div className="filter" role="group" aria-label="Show">
              {filters.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="controls-secondary">
              <div className="toggle-group" role="group" aria-label="View">
                <button
                  type="button"
                  aria-pressed={view === "covers"}
                  onClick={() => {
                    setView("covers");
                    setHoveredSlug(null);
                  }}
                >
                  Covers
                </button>
                <button
                  type="button"
                  aria-pressed={view === "spines"}
                  onClick={() => setView("spines")}
                >
                  Spines
                </button>
              </div>
              <div className="toggle-group" role="group" aria-label="Order">
                <button
                  type="button"
                  aria-pressed={orderBy === "shelf"}
                  onClick={() => setOrderBy("shelf")}
                >
                  By shelf
                </button>
                <button
                  type="button"
                  aria-pressed={orderBy === "recent"}
                  onClick={() => setOrderBy("recent")}
                >
                  Recently read
                </button>
              </div>
            </div>

            <label className="search">
              <span className="sr-only">Filter books</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setQuery("");
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Search title or author…"
                aria-label="Search books by title or author"
              />
              {query ? (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  ×
                </button>
              ) : (
                <kbd aria-hidden="true">/</kbd>
              )}
            </label>
          </div>

          <nav aria-label="Shelves">
            {groups.length > 0 ? (
              <ol className="toc">
                {groups.map((group) => (
                  <li key={group.id}>
                    <a href={`#${group.id}`} onClick={jump(group.id)}>
                      <span className="numeral">{group.numeral}</span>
                      <span className="name">{group.name}</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="count">{group.books.length}</span>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">
                No books match “{query.trim()}”.{" "}
                <button type="button" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </p>
            )}
          </nav>
        </section>

        {groups.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className="shelf"
            aria-labelledby={`${group.id}-title`}
          >
            <header className="shelf-head">
              <span className="numeral" aria-hidden="true">
                {group.numeral}
              </span>
              <h2 id={`${group.id}-title`}>{group.name}</h2>
              <p>
                {group.books.length} {group.books.length === 1 ? "book" : "books"}
              </p>
            </header>
            <ol className="books">
              {group.books.map((book) => (
                <li
                  key={book.slug}
                  id={book.slug}
                  className="book"
                  data-status={book.status}
                  style={
                    {
                      "--aspect": book.aspect,
                      "--thick": book.thick,
                    } as CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="cover"
                    aria-label={`${book.shortTitle} by ${book.author}`}
                    ref={(node) => {
                      if (node) slotRefs.current.set(book.slug, node);
                      else slotRefs.current.delete(book.slug);
                    }}
                    onClick={() => open(book.slug)}
                    onPointerMove={tilt(book)}
                    onPointerLeave={() => {
                      if (drifting.current === null) engineRef.current?.setHover(null);
                      setHoveredSlug((cur) => (cur === book.slug ? null : cur));
                    }}
                    onFocus={(event) => {
                      if (event.currentTarget.matches(":focus-visible")) {
                        engineRef.current?.setHover(book.index);
                        if (view === "spines") setHoveredSlug(book.slug);
                      }
                    }}
                    onBlur={() => {
                      engineRef.current?.setHover(null);
                      setHoveredSlug((cur) => (cur === book.slug ? null : cur));
                    }}
                  >
                    {gpu === "off" && (
                      <Cover
                        book={book}
                        view={view}
                        sizes="(min-width: 60rem) 11rem, (min-width: 30rem) 30vw, 44vw"
                      />
                    )}
                  </button>
                  <div className="caption">
                    <h3>{book.shortTitle}</h3>
                    <p className="author">{book.author}</p>
                    <p className="status" data-status={book.status}>
                      {statusLine(book)}
                    </p>
                    {book.note && <p className="note">{book.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <footer className="colophon">
          <p>
            Set in Cormorant Garamond and Lora. The books are drawn live with WebGPU; covers come
            from Apple Books and Open Library.
          </p>
          <nav aria-label="Elsewhere">
            <Link href="/">Home</Link>
            <Link href="/writing">Writing</Link>
          </nav>
        </footer>
      </div>

      {view === "spines" && !isOpen && hoveredBook && (
        <div className="spine-readout" aria-live="polite">
          <strong>{hoveredBook.shortTitle}</strong>
          <span>{hoveredBook.author}</span>
          <em>{statusLine(hoveredBook)}</em>
        </div>
      )}

      <div className="scrim" onClick={close} aria-hidden="true" />
      <div className="stage" ref={stageRef} aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>

      {selected && previous && following && (
        <div
          className="detail"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
          onScroll={measureBox}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <button type="button" className="detail-close" ref={closeRef} onClick={close}>
            Close
          </button>
          <div className="detail-stage">
            <div
              className="detail-book"
              ref={boxRef}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragFrom.current = { x: event.clientX, y: event.clientY, moved: 0 };
              }}
              onPointerMove={(event) => {
                const from = dragFrom.current;
                if (!from) return;
                const dx = event.clientX - from.x;
                const dy = event.clientY - from.y;
                engineRef.current?.drag(dx, event.pointerType === "touch" ? 0 : dy);
                const moved = from.moved + Math.abs(dx) + Math.abs(dy);
                if (moved > 8 && !interacted) setInteracted(true);
                dragFrom.current = {
                  x: event.clientX,
                  y: event.clientY,
                  moved,
                };
              }}
              onPointerUp={() => {
                // A drag turns the book; a click flips smoothly between front and back cover.
                const from = dragFrom.current;
                dragFrom.current = null;
                if (from && from.moved < 6) {
                  setInteracted(true);
                  engineRef.current?.flip();
                }
              }}
              onPointerCancel={() => (dragFrom.current = null)}
            >
              {gpu === "off" && (
                <Cover book={selected} view="covers" sizes="(min-width: 50rem) 26rem, 60vw" />
              )}
            </div>
            {gpu === "on" && (
              <p className="detail-hint" data-faded={interacted ? "" : undefined}>
                Drag to turn · Click to flip · ← → to browse
              </p>
            )}
          </div>
          <div className="detail-text" key={selected.slug}>
            <h2 id="detail-title">{selected.shortTitle}</h2>
            {selected.subtitle && <p className="detail-subtitle">{selected.subtitle}</p>}
            <p className="detail-author">{selected.author}</p>
            {selected.note && <p className="detail-note">{selected.note}</p>}
            <p className="detail-facts">
              <span data-status={selected.status}>{statusLine(selected)}</span>
              <span>{selected.shelf}</span>
            </p>
            <ul className="detail-links">
              {selected.mentionedIn?.map((mention) => (
                <li key={mention.href}>
                  <Link href={mention.href}>
                    Mentioned in <em>{mention.title}</em>
                  </Link>
                </li>
              ))}
              <li>
                <a href={bookshopSearchUrl(selected)} target="_blank" rel="noreferrer">
                  Find it on Bookshop.org
                </a>
              </li>
              <li>
                <button type="button" className="detail-copy" onClick={copyLink}>
                  {copied ? "Link copied" : "Copy link to this book"}
                </button>
              </li>
            </ul>
          </div>
          <nav className="detail-pager" aria-label="Other books">
            <button type="button" onClick={() => step(-1)}>
              <span aria-hidden="true">←</span> {previous.shortTitle}
            </button>
            <button type="button" onClick={() => step(1)}>
              {following.shortTitle} <span aria-hidden="true">→</span>
            </button>
          </nav>
        </div>
      )}
    </main>
  );
}
