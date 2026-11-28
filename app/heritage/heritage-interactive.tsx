"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createWaterEngine, type WaterEngine } from "./gpu/water-engine";

type RootBranchId = "teich" | "deich" | "taykh" | "ditch";

type RootBranch = {
  id: RootBranchId;
  tabLabel: string;
  term: string;
  pronunciation: string;
  meaning: string;
  region: string;
  explanation: string;
};

const ROOT_BRANCHES: RootBranch[] = [
  {
    id: "teich",
    tabLabel: "German: Teich",
    term: "Teich",
    pronunciation: "/taɪç/",
    meaning: "Pond, artificial fishpond",
    region: "Central and eastern Germany",
    explanation:
      "In inland High German, Middle High German tīch settled on the water held inside the dug basin: a controlled pond with an inlet and outlet, often built for carp farming.",
  },
  {
    id: "deich",
    tabLabel: "German: Deich",
    term: "Deich",
    pronunciation: "/daɪç/",
    meaning: "Dike, flood embankment",
    region: "North Sea coast and low rivers",
    explanation:
      "Along the northern coast, the raised wall of excavated earth mattered more than the trench. Low German dīk entered standard German as Deich, creating a twin to Teich from the same root.",
  },
  {
    id: "taykh",
    tabLabel: "Yiddish: טײַך",
    term: "טײַך (taykh)",
    pronunciation: "/tajχ/",
    meaning: "River, stream",
    region: "Ashkenazi Eastern and Central Europe",
    explanation:
      "Carried eastward from Middle High German tīch, the long vowel shifted into Yiddish ay and the meaning widened from banked, standing water to moving water: a river.",
  },
  {
    id: "ditch",
    tabLabel: "English: Ditch & dike",
    term: "Ditch and dike",
    pronunciation: "/dɪtʃ/, /daɪk/",
    meaning: "The cut trench and the raised bank",
    region: "Old English dīc",
    explanation:
      "English preserved both halves of the original earthwork side by side: ditch for the hollowed channel and dike for the ridge of soil thrown up beside it.",
  },
];

export function TeichWaterCanvas({ imageUrl }: { imageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (reducedMotion.matches) return;

    let cancelled = false;
    let engine: WaterEngine | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastMoveAt = 0;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && engine) {
          engine.setActive(entry.isIntersecting);
        }
      },
      { threshold: 0.02 }
    );
    io.observe(canvas);

    const onPointerMove = (event: PointerEvent) => {
      if (!engine) return;
      const now = performance.now();
      const dt = Math.max(now - lastMoveAt, 16);
      const dist = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
      lastMoveAt = now;

      if (dist < 2) return;
      const speed = Math.min(dist / dt, 2.2);
      const strength = Math.min(0.14 + speed * 0.28, 0.55);
      engine.disturb(event.clientX, event.clientY, strength, 0.024);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!engine) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button")) return;
      engine.disturb(event.clientX, event.clientY, 0.82, 0.032);
    };

    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches && engine) {
        engine.destroy();
        engine = null;
        setReady(false);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    reducedMotion.addEventListener("change", onReducedMotionChange);

    createWaterEngine(canvas, imageUrl, () => {
      if (!cancelled) setReady(true);
    }).then((created) => {
      if (cancelled) {
        created?.destroy();
        return;
      }
      engine = created;
    });

    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      engine?.destroy();
    };
  }, [imageUrl]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{
        opacity: ready ? 1 : 0,
        transition: "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    />
  );
}

export function HeritageHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 48);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`heritage-header fixed inset-x-0 top-0 z-30 border-b ${
        scrolled
          ? "border-[var(--h-rule)] bg-[rgba(244,246,245,0.92)] text-[var(--h-text)] backdrop-blur-md"
          : "border-transparent bg-transparent text-[var(--h-text-on-dark)]"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link
          href="/"
          className="heritage-serif heritage-link text-[1.35rem] font-semibold tracking-[-0.02em] hover:opacity-80"
        >
          teich.net
        </Link>

        <nav
          aria-label="Primary"
          className="heritage-sans heritage-sm flex items-center gap-7"
        >
          <Link
            href="/"
            className={`heritage-link ${
              scrolled
                ? "text-[var(--h-text-muted)] hover:text-[var(--h-text)]"
                : "text-[var(--h-text-on-dark-muted)] hover:text-[var(--h-text-on-dark)]"
            }`}
          >
            Home
          </Link>
          <Link
            href="/crest"
            className={`heritage-link ${
              scrolled
                ? "text-[var(--h-text-muted)] hover:text-[var(--h-text)]"
                : "text-[var(--h-text-on-dark-muted)] hover:text-[var(--h-text-on-dark)]"
            }`}
          >
            Crest
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function RootExplorer() {
  const [activeId, setActiveId] = useState<RootBranchId>("teich");
  const active =
    ROOT_BRANCHES.find((branch) => branch.id === activeId) ?? ROOT_BRANCHES[0];

  const highlightBank = activeId === "deich" || activeId === "ditch";
  const highlightBasin = activeId === "teich" || activeId === "ditch";
  const highlightFlow = activeId === "taykh";

  return (
    <div className="border-t border-[var(--h-rule)] pt-7">
      <div
        role="tablist"
        aria-label="Words descended from West Germanic dika"
        className="heritage-sans heritage-sm grid grid-cols-2 border border-[var(--h-rule)] bg-[var(--h-surface-subtle)] p-1 sm:grid-cols-4"
      >
        {ROOT_BRANCHES.map((branch) => {
          const isSelected = branch.id === activeId;
          return (
            <button
              key={branch.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`root-panel-${branch.id}`}
              id={`root-tab-${branch.id}`}
              onClick={() => setActiveId(branch.id)}
              className={`heritage-tab cursor-pointer px-3 py-2.5 text-left font-medium sm:text-center ${
                isSelected
                  ? "bg-[var(--h-ink-surface)] text-[var(--h-text-on-dark)]"
                  : "text-[var(--h-text-muted)] hover:text-[var(--h-text)]"
              }`}
            >
              {branch.tabLabel}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`root-panel-${active.id}`}
        aria-labelledby={`root-tab-${active.id}`}
        className="mt-6 grid gap-8 bg-[var(--h-surface-subtle)] p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:items-center"
      >
        <div className="overflow-hidden bg-[var(--h-ink-surface)] p-5 sm:p-6">
          <svg
            viewBox="0 0 460 220"
            className="block h-auto w-full"
            role="img"
            aria-label={`Cross-section diagram illustrating ${active.term}: ${active.meaning}`}
          >
            {/* Subtle survey grid */}
            <g stroke="rgba(242,246,246,0.08)" strokeWidth="1">
              <line x1="20" y1="54" x2="440" y2="54" />
              <line x1="20" y1="104" x2="440" y2="104" />
              <line x1="20" y1="154" x2="440" y2="154" />
              <line x1="120" y1="24" x2="120" y2="192" />
              <line x1="240" y1="24" x2="240" y2="192" />
              <line x1="360" y1="24" x2="360" y2="192" />
            </g>

            {/* Base terrain profile */}
            <path
              d="M 20 132 L 90 132 C 115 132 132 76 164 76 C 196 76 212 132 232 146 L 266 172 L 386 172 L 414 132 L 440 132 L 440 196 L 20 196 Z"
              fill="#142931"
              stroke="rgba(242,246,246,0.28)"
              strokeWidth="1.25"
            />

            {/* Highlighted earthen bank (Deich / dike) */}
            <g
              className="heritage-diagram-layer"
              style={{ opacity: highlightBank ? 1 : 0.16 }}
            >
              <path
                d="M 90 132 C 115 132 132 76 164 76 C 196 76 212 132 232 146 L 232 152 L 90 152 Z"
                fill="#8fd0d4"
                fillOpacity="0.24"
              />
              <path
                d="M 90 132 C 115 132 132 76 164 76 C 196 76 212 132 232 146"
                fill="none"
                stroke="#8fd0d4"
                strokeWidth="2.5"
              />
              <text
                x="164"
                y="56"
                textAnchor="middle"
                fill="#f2f6f6"
                fontSize="13"
                className="heritage-sans"
              >
                Raised earth (bank)
              </text>
            </g>

            {/* Highlighted standing water basin (Teich / ditch) */}
            <g
              className="heritage-diagram-layer"
              style={{ opacity: highlightBasin ? 1 : 0.16 }}
            >
              <path
                d="M 222 134 L 412 134 L 386 172 L 266 172 Z"
                fill="#2d8c96"
                fillOpacity="0.45"
              />
              <line
                x1="222"
                y1="134"
                x2="412"
                y2="134"
                stroke="#8fd0d4"
                strokeWidth="2.2"
              />
              <line
                x1="252"
                y1="149"
                x2="380"
                y2="149"
                stroke="rgba(143,208,212,0.55)"
                strokeWidth="1.2"
              />
              <text
                x="322"
                y="116"
                textAnchor="middle"
                fill="#f2f6f6"
                fontSize="13"
                className="heritage-sans"
              >
                {activeId === "ditch" ? "Cut trench" : "Held water (pond)"}
              </text>
            </g>

            {/* Flowing river current overlay (Yiddish taykh) */}
            <g
              className="heritage-diagram-layer"
              style={{ opacity: highlightFlow ? 1 : 0 }}
            >
              <path
                d="M 20 120 C 90 108, 150 138, 230 124 C 310 110, 370 134, 440 120 L 440 166 C 370 176, 310 156, 230 168 C 150 180, 90 152, 20 164 Z"
                fill="#2d8c96"
                fillOpacity="0.48"
              />
              <path
                d="M 38 134 C 110 124, 175 148, 250 136 C 325 124, 380 144, 424 134"
                fill="none"
                stroke="#8fd0d4"
                strokeWidth="2"
              />
              <path
                d="M 62 150 C 135 142, 195 162, 275 150 C 335 142, 378 156, 408 150"
                fill="none"
                stroke="rgba(143,208,212,0.6)"
                strokeWidth="1.4"
              />
              <path
                d="M 416 128 L 426 134 L 416 140"
                fill="none"
                stroke="#8fd0d4"
                strokeWidth="2"
              />
              <text
                x="230"
                y="94"
                textAnchor="middle"
                fill="#f2f6f6"
                fontSize="13"
                className="heritage-sans"
              >
                Open current (river)
              </text>
            </g>

            {/* Baseline root caption */}
            <text
              x="28"
              y="208"
              fill="#b0c4c7"
              fontSize="13"
              className="heritage-sans"
            >
              West Germanic *dīka- · Middle High German tīch
            </text>
          </svg>
        </div>

        <div>
          <p className="heritage-serif heritage-h2 text-[var(--h-text)]">
            {active.term}
          </p>
          <p className="heritage-sans heritage-sm mt-2 text-[var(--h-accent)] font-medium">
            {active.pronunciation} · {active.meaning}
          </p>
          <p className="heritage-body mt-4 text-[var(--h-text)]">
            {active.explanation}
          </p>
          <p className="heritage-sans heritage-sm mt-4 text-[var(--h-text-muted)]">
            Primary use: {active.region}
          </p>
        </div>
      </div>
    </div>
  );
}
