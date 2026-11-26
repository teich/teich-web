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
import type { Engine } from "./gpu/engine";
import { formatDateRead, library, shelves, type ShelfBook } from "./library";

type Filter = "all" | "read" | "to-read";
type Gpu = "pending" | "on" | "off";

const filters: { key: Filter; label: string; count: number }[] = [
  { key: "all", label: "All", count: library.length },
  { key: "read", label: "Read", count: library.filter((b) => b.status === "read").length },
  { key: "to-read", label: "To read", count: library.filter((b) => b.status === "to-read").length },
];

const bySlug = new Map(library.map((book) => [book.slug, book]));

function Cover({ book, sizes }: { book: ShelfBook; sizes: string }) {
  if (!book.cover) {
    return (
      <span
        className="cloth"
        style={{ "--cloth": `rgb(${book.color.map((c) => Math.round(c * 255)).join(" ")})` } as CSSProperties}
      >
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

function statusLine(book: ShelfBook) {
  if (book.status === "to-read") return "To read";
  return book.dateRead ? `Read ${formatDateRead(book.dateRead)}` : "Read";
}

export default function ReadingRoom() {
  const [filter, setFilter] = useState<Filter>("all");
  const [gpu, setGpu] = useState<Gpu>("pending");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const pushed = useRef(false);
  const returnTo = useRef<string | null>(null);
  const dragFrom = useRef<{ x: number; y: number; moved: number } | null>(null);
  const drifting = useRef<number | null>(null);

  const visible = useMemo(
    () =>
      shelves
        .map((shelf) => ({
          ...shelf,
          books: shelf.books.filter((book) => filter === "all" || book.status === filter),
        }))
        .filter((shelf) => shelf.books.length > 0),
    [filter],
  );
  const order = useMemo(() => visible.flatMap((shelf) => shelf.books), [visible]);
  const selected = selectedSlug ? (bySlug.get(selectedSlug) ?? null) : null;

  // ── Renderer ───────────────────────────────────────────────────────────
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
        };
      }),
    );
    const holder = boxRef.current?.getBoundingClientRect();
    if (holder) {
      engine.setBox({
        x: holder.left + holder.width / 2,
        y: holder.top + holder.height / 2,
        w: holder.width,
        h: holder.height,
      });
    }
  }, []);

  useEffect(() => {
    let dead = false;
    let engine: Engine | null = null;
    (async () => {
      if (!("gpu" in navigator)) return setGpu("off");
      try {
        const { createEngine } = await import("./gpu/engine");
        const main = mainRef.current;
        if (dead || !main || !canvasRef.current || !stageRef.current) return;
        engine = await createEngine({
          canvas: canvasRef.current,
          stage: stageRef.current,
          books: library,
          fontFamily:
            getComputedStyle(main).getPropertyValue("--font-reading-display").trim() || "serif",
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
    measure();
    engineRef.current?.setSelected(selected ? selected.index : null);
  }, [measure, gpu, filter, selected]);

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
      const list = order.some((book) => book.slug === selectedSlug) ? order : library;
      const at = list.findIndex((book) => book.slug === selectedSlug);
      const next = list[(at + delta + list.length) % list.length];
      window.history.replaceState(null, "", `#${next.slug}`);
      setSelectedSlug(next.slug);
    },
    [order, selectedSlug],
  );

  useEffect(() => {
    if (!selectedSlug) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
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
  const tilt = (index: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.setHover(
      index,
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1,
    );
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
    <main ref={mainRef} className="reading" data-gpu={gpu} data-detail={isOpen ? "" : undefined}>
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
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          const hit = engineRef.current?.pick(event.clientX, event.clientY) ?? null;
          if (hit === drifting.current) return;
          drifting.current = hit;
          event.currentTarget.toggleAttribute("data-pick", hit !== null);
          engineRef.current?.setHover(hit);
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
          <nav aria-label="Shelves">
            <ol className="toc">
              {visible.map((shelf) => (
                <li key={shelf.id}>
                  <a href={`#${shelf.id}`} onClick={jump(shelf.id)}>
                    <span className="numeral">{shelf.numeral}</span>
                    <span className="name">{shelf.name}</span>
                    <span className="leader" aria-hidden="true" />
                    <span className="count">{shelf.books.length}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        {visible.map((shelf) => (
          <section key={shelf.id} id={shelf.id} className="shelf" aria-labelledby={`${shelf.id}-title`}>
            <header className="shelf-head">
              <span className="numeral" aria-hidden="true">
                {shelf.numeral}
              </span>
              <h2 id={`${shelf.id}-title`}>{shelf.name}</h2>
              <p>
                {shelf.books.length} {shelf.books.length === 1 ? "book" : "books"}
              </p>
            </header>
            <ol className="books">
              {shelf.books.map((book) => (
                <li
                  key={book.slug}
                  id={book.slug}
                  className="book"
                  data-status={book.status}
                  style={{ "--aspect": book.aspect } as CSSProperties}
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
                    onPointerMove={tilt(book.index)}
                    onPointerLeave={() => engineRef.current?.setHover(null)}
                    onFocus={(event) => {
                      if (event.currentTarget.matches(":focus-visible"))
                        engineRef.current?.setHover(book.index);
                    }}
                    onBlur={() => engineRef.current?.setHover(null)}
                  >
                    {gpu !== "on" && (
                      <Cover book={book} sizes="(min-width: 60rem) 11rem, (min-width: 30rem) 30vw, 44vw" />
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
          onScroll={measure}
        >
          <button type="button" className="detail-close" ref={closeRef} onClick={close}>
            Close
          </button>
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
              dragFrom.current = {
                x: event.clientX,
                y: event.clientY,
                moved: from.moved + Math.abs(dx) + Math.abs(dy),
              };
            }}
            onPointerUp={() => {
              // A drag turns the book; a plain click puts it back.
              const from = dragFrom.current;
              dragFrom.current = null;
              if (from && from.moved < 6) close();
            }}
            onPointerCancel={() => (dragFrom.current = null)}
          >
            {gpu !== "on" && <Cover book={selected} sizes="(min-width: 50rem) 26rem, 60vw" />}
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
