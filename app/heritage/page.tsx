import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import {
  HeritageHeader,
  RootExplorer,
  TeichWaterCanvas,
} from "./heritage-interactive";
import "./heritage.css";

const serifFont = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-heritage-serif",
});

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heritage-sans",
});

export const metadata: Metadata = {
  title: "Teich: On the Name",
  description:
    "The linguistic roots, dual Central European origins, and geographic history of the surname Teich.",
};

type NotableBearer = {
  name: string;
  dates: string;
  field: string;
  note: string;
};

const BEARERS: NotableBearer[] = [
  {
    name: "Curt Teich",
    dates: "1877–1974",
    field: "Printer and publisher, Thuringia to Chicago",
    note: "Born into a printing family in Greiz and trained in Lobenstein, he moved to Chicago in 1895 and built Curt Teich & Company into the world's largest postcard printer. His presses created the vibrant mid-century linen postcard and the large-letter \"Greetings From\" series; millions of his prints are archived at Chicago's Newberry Library.",
  },
  {
    name: "Frank Teich",
    dates: "1856–1939",
    field: "Sculptor and stone carver, Germany to Texas",
    note: "Emigrated to the United States in the late nineteenth century, supervised granite cutting for the Texas State Capitol, and helped establish the granite carving industry across central Texas.",
  },
  {
    name: "Erich Teich",
    dates: "1908–1983",
    field: "Musician and conductor, Hamburg to Tel Aviv",
    note: "Trained at the Brahms Conservatory in Hamburg before emigrating to Mandatory Palestine in the 1930s on a pioneer certificate. In 1948 he founded the Israel Air Force Orchestra and led it for thirty-five years in a distinctive big-band and jazz idiom.",
  },
  {
    name: "Mikuláš Teich and Alice Teichová",
    dates: "1918–2018; 1920–2015",
    field: "Historians of science and economics, Košice and Vienna to Cambridge",
    note: "Both fled Nazi-occupied Central Europe to Britain, married in 1944, and spent decades writing and editing landmark studies of Central European economic and scientific history.",
  },
  {
    name: "Malvin Carl Teich",
    dates: "b. 1939",
    field: "Physicist and engineer, United States",
    note: "Professor emeritus at Columbia University and Boston University, recognized for foundational research in quantum optics, photonics, and information theory.",
  },
];

export default function HeritagePage() {
  return (
    <div
      className={`${serifFont.variable} ${sansFont.variable} heritage-page min-h-screen`}
    >
      <HeritageHeader />

      {/* Opening Full-Bleed Stage */}
      <section className="relative flex min-h-[86svh] w-full items-end overflow-hidden bg-[var(--h-ink-surface)] text-[var(--h-text-on-dark)]">
        <Image
          src="/teich-pond-hero.jpg"
          alt="A still Central European pond and grassy earthen dike bank under twilight mist"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <TeichWaterCanvas imageUrl="/teich-pond-hero.jpg" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(12,26,31,0.34)_0%,rgba(12,26,31,0.04)_28%,rgba(12,26,31,0.16)_52%,rgba(12,26,31,0.74)_82%,rgba(12,26,31,0.92)_100%)]"
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-32 sm:px-10 sm:pb-24">
          <div className="max-w-3xl">
            <h1 className="heritage-serif heritage-h1 heritage-hero-enter text-[var(--h-text-on-dark)]">
              Teich
            </h1>
            <p className="heritage-body heritage-hero-enter-delayed mt-6 max-w-[44ch] text-[var(--h-text-on-dark-muted)]">
              Pond in German, river in Yiddish. One word for water held by
              earth, carried across Central Europe.
            </p>
            <div className="heritage-hero-enter-delayed mt-8">
              <a
                href="#etymology"
                className="heritage-sans heritage-sm heritage-cta inline-flex items-center gap-2.5 bg-[var(--h-page)] px-5 py-3 font-medium text-[var(--h-text)] hover:bg-white"
              >
                Read the history
                <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main>
        {/* Section 1: Etymology & Interactive Root Split */}
        <section
          id="etymology"
          className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <h2 className="heritage-serif heritage-h2 text-[var(--h-text)]">
                Still water in one tongue, running water in another
              </h2>
              <p className="heritage-sans heritage-sm mt-5 text-[var(--h-text-muted)]">
                Pronounced <span className="text-[var(--h-text)]">/taɪç/</span>{" "}
                in German,{" "}
                <span className="text-[var(--h-text)]">/tajχ/</span> in Yiddish,
                and <span className="text-[var(--h-text)]">/taɪk/</span> or{" "}
                <span className="text-[var(--h-text)]">/taɪʃ/</span> in English.
              </p>
            </div>

            <div className="max-w-[62ch] space-y-6">
              <p className="heritage-body text-[var(--h-text)]">
                In German, <em>Teich</em> means a pond. Specifically, in older
                and technical usage, it names a dug basin with an inlet and an
                outlet that can be drained, as distinct from a natural pool,
                which southern Germans and Austrians call a <em>Weiher</em>. In
                Yiddish, the exact same word, <em>taykh</em> (טײַך), widened its
                banks and came to mean a river.
              </p>
              <p className="heritage-body text-[var(--h-text)]">
                The divergence goes back to a single piece of medieval
                earthwork. German <em>Teich</em> and <em>Deich</em> (dike),
                along with English <em>ditch</em> and <em>dike</em> and Dutch{" "}
                <em>dijk</em>, all descend from the same West Germanic root (
                <em>*dīka-</em>, Middle High German <em>tīch</em>). Dig a trench
                to hold or channel water, and the soil thrown up beside it forms
                a wall. One word originally named both the hollow and the ridge.
              </p>
              <p className="heritage-body text-[var(--h-text)]">
                Geography split the word in two. Along the North Sea coast and
                flood-prone rivers, survival depended on the wall, so Low German{" "}
                <em>dīk</em> kept the sense of embankment and later entered
                standard German as <em>Deich</em>. Inland across central and
                eastern German lands, where estates and monasteries built
                extensive artificial carp ponds (<em>Fischteiche</em>), High
                German <em>tīch</em> settled on the standing water inside the
                bank. Carried east into Yiddish, the vowel shifted in parallel
                and the sense opened outward from contained water to a flowing
                stream.
              </p>
            </div>
          </div>

          <div className="mt-14">
            <RootExplorer />
          </div>
        </section>

        {/* Section 2: Full-Bleed Dark Architectural Spread for Dual Origins */}
        <section className="bg-[var(--h-ink-surface)] text-[var(--h-text-on-dark)]">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
            <h2 className="heritage-serif heritage-h2 max-w-2xl text-[var(--h-text-on-dark)]">
              Two histories behind one surname
            </h2>
            <p className="heritage-body mt-5 max-w-[62ch] text-[var(--h-text-on-dark-muted)]">
              Like many Central European family names, Teich did not spread from
              a single ancestor. It entered the historical record through two
              distinct streams that drew on the same word centuries apart.
            </p>

            <div className="mt-14 grid gap-12 border-t border-[var(--h-rule-on-dark)] pt-12 md:grid-cols-2 md:gap-16">
              <div>
                <h3 className="heritage-sans heritage-body font-semibold text-[var(--h-accent-on-dark)]">
                  German topographic and place names
                </h3>
                <div className="mt-5 max-w-[58ch] space-y-5 text-[var(--h-text-on-dark-muted)]">
                  <p className="heritage-body">
                    As hereditary surnames took hold in German-speaking Europe
                    during the late Middle Ages and early modern period,{" "}
                    <span className="text-[var(--h-text-on-dark)]">Teich</span>{" "}
                    served as a residence name for families who lived beside a
                    pond, dam, or drainage ditch, or who came from settlements
                    such as Teicha in Saxony and Saxony-Anhalt or Teichau in
                    Silesia (now Stawiska, Poland).
                  </p>
                  <p className="heritage-body">
                    Because everyday German divides geographically between
                    northern and central <em>Teich</em> and southern{" "}
                    <em>Weiher</em>, the surname clustered heavily in Saxony,
                    Silesia, and Thuringia. Related occupational and residence
                    names from the same landscape include{" "}
                    <span className="text-[var(--h-text-on-dark)]">
                      Teichmann, Teichert, Teichmüller, and Teichfischer
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--h-rule-on-dark)] pt-10 md:border-l md:border-t-0 md:pl-14 md:pt-0">
                <h3 className="heritage-sans heritage-body font-semibold text-[var(--h-accent-on-dark)]">
                  Ashkenazi Jewish adoption
                </h3>
                <div className="mt-5 max-w-[58ch] space-y-5 text-[var(--h-text-on-dark-muted)]">
                  <p className="heritage-body">
                    Until the late eighteenth century, most Central and Eastern
                    European Jews used patronymics rather than inherited family
                    names. That changed by imperial decree, beginning with
                    Habsburg Emperor Joseph II&apos;s{" "}
                    <em>Patent über die Judennamen</em> of July 23, 1787 across
                    Galicia, Bohemia, Moravia, and Bukovina, followed by similar
                    edicts in Prussia (1812) and the Kingdom of Poland (1821).
                  </p>
                  <p className="heritage-body">
                    Families chose, or registrars entered, German-language
                    surnames drawn heavily from nature: <em>Berg</em>,{" "}
                    <em>Stein</em>, <em>Bach</em>, <em>Wald</em>, and{" "}
                    <em>Teich</em>. For Yiddish speakers, Teich worked in two
                    languages at once: an ordinary German noun for the imperial
                    ledger, and their own word for a river. Records across
                    Galicia, Poland, and Vienna also preserve phonetic variants
                    and compounds including{" "}
                    <span className="text-[var(--h-text-on-dark)]">
                      Taich, Teicher, Teichman, Teichholtz, and Teichtal
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Migration & Geographic Spread + Minimalist Atlas Schematic */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
            <div className="max-w-[62ch]">
              <h2 className="heritage-serif heritage-h2 text-[var(--h-text)]">
                How a small name traveled
              </h2>
              <div className="mt-7 space-y-6 text-[var(--h-text)]">
                <p className="heritage-body">
                  Teich has never been a common surname. Only a few thousand
                  people carry it worldwide today, yet its map traces two of the
                  defining European migrations of the nineteenth and twentieth
                  centuries.
                </p>
                <p className="heritage-body">
                  During the nineteenth century, German families from Saxony,
                  Thuringia, and Silesia joined the broad emigration to the
                  Americas, establishing branches in the American Midwest,
                  Texas, and Brazil.
                </p>
                <p className="heritage-body">
                  Along a parallel track, Jewish families from Galicia and
                  Poland moved steadily into Vienna and other cities of the
                  Austro-Hungarian Empire over the nineteenth and early
                  twentieth centuries. In the 1930s, as economic exclusion
                  deepened in Poland and Nazi persecution engulfed Germany and
                  Austria, those who managed to leave scattered toward
                  Mandatory Palestine during the Fifth Aliyah, Britain, South
                  Africa, and the Americas.
                </p>
                <p className="heritage-body">
                  The Holocaust devastated the European communities where Jewish
                  Teich families had lived; Austria, once home to a notable
                  Jewish community bearing the name, counts only a few dozen
                  today. In Israel, some immigrant families kept the name while
                  others Hebraicized German surnames into Hebrew equivalents.
                  Today the largest concentrations remain in Germany and the
                  United States, with smaller communities in Israel, South
                  Africa, Canada, Brazil, and Argentina.
                </p>
              </div>
            </div>

            <figure className="bg-[var(--h-surface-subtle)] p-6 sm:p-8">
              <svg
                viewBox="0 0 460 360"
                className="block h-auto w-full"
                role="img"
                aria-label="Schematic map of historical routes carrying the surname Teich from Saxony, Silesia, and Galicia through Vienna to the Americas, Britain, and the Levant"
              >
                {/* Faint cartographic graticule */}
                <g stroke="rgba(18,28,31,0.08)" strokeWidth="1">
                  <line x1="20" y1="70" x2="440" y2="70" />
                  <line x1="20" y1="145" x2="440" y2="145" />
                  <line x1="20" y1="220" x2="440" y2="220" />
                  <line x1="20" y1="295" x2="440" y2="295" />
                  <line x1="115" y1="20" x2="115" y2="335" />
                  <line x1="230" y1="20" x2="230" y2="335" />
                  <line x1="345" y1="20" x2="345" y2="335" />
                </g>

                {/* Origin zone ellipse: Central Europe */}
                <ellipse
                  cx="274"
                  cy="134"
                  rx="76"
                  ry="42"
                  fill="rgba(24,90,97,0.11)"
                  stroke="rgba(24,90,97,0.35)"
                  strokeWidth="1.2"
                />

                {/* Routes */}
                <g fill="none" strokeLinecap="round">
                  {/* Galicia / Poland -> Vienna */}
                  <path
                    d="M 326 124 Q 294 148 264 166"
                    stroke="#185a61"
                    strokeWidth="2"
                  />
                  {/* Saxony & Silesia -> Atlantic / North America */}
                  <path
                    d="M 248 112 Q 168 88 76 118"
                    stroke="#121c1f"
                    strokeWidth="1.75"
                    strokeDasharray="4 4"
                  />
                  {/* Central Europe -> Britain */}
                  <path
                    d="M 254 128 Q 202 114 156 126"
                    stroke="#185a61"
                    strokeWidth="1.6"
                  />
                  {/* Vienna -> Mediterranean / Mandatory Palestine */}
                  <path
                    d="M 264 166 Q 308 228 364 282"
                    stroke="#185a61"
                    strokeWidth="2"
                  />
                  {/* Europe -> South America & South Africa */}
                  <path
                    d="M 252 174 Q 178 242 96 296"
                    stroke="#46575c"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M 268 176 Q 268 252 288 314"
                    stroke="#46575c"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </g>

                {/* Nodes */}
                <g>
                  <circle cx="248" cy="112" r="4.5" fill="#121c1f" />
                  <circle cx="326" cy="124" r="4.5" fill="#185a61" />
                  <circle cx="264" cy="166" r="5" fill="#185a61" />
                  <circle cx="156" cy="126" r="3.5" fill="#185a61" />
                  <circle cx="76" cy="118" r="4" fill="#121c1f" />
                  <circle cx="364" cy="282" r="4.5" fill="#185a61" />
                  <circle cx="96" cy="296" r="3.5" fill="#46575c" />
                  <circle cx="288" cy="314" r="3.5" fill="#46575c" />
                </g>

                {/* Labels */}
                <g className="heritage-sans" fontSize="13">
                  <text x="248" y="96" textAnchor="middle" fill="#121c1f" fontWeight="600">
                    Saxony &amp; Silesia
                  </text>
                  <text x="330" y="106" textAnchor="start" fill="#185a61" fontWeight="600">
                    Galicia &amp; Poland
                  </text>
                  <text x="250" y="182" textAnchor="end" fill="#185a61" fontWeight="600">
                    Vienna
                  </text>
                  <text x="156" y="148" textAnchor="middle" fill="#46575c">
                    Britain
                  </text>
                  <text x="76" y="142" textAnchor="middle" fill="#121c1f">
                    North America
                  </text>
                  <text x="364" y="304" textAnchor="middle" fill="#185a61" fontWeight="600">
                    Levant / Israel
                  </text>
                  <text x="96" y="318" textAnchor="middle" fill="#46575c">
                    South America
                  </text>
                  <text x="288" y="334" textAnchor="middle" fill="#46575c">
                    South Africa
                  </text>
                </g>
              </svg>
              <figcaption className="heritage-sans heritage-sm mt-5 border-t border-[var(--h-rule)] pt-4 text-[var(--h-text-muted)]">
                Schematic of principal movement corridors: nineteenth-century
                German emigration (dashed) and nineteenth- to twentieth-century
                Ashkenazi migration out of Galicia, Poland, and Vienna (solid).
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Section 4: Curated Directory of Bearers */}
        <section className="border-t border-[var(--h-rule)] bg-[var(--h-surface-subtle)]">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
            <h2 className="heritage-serif heritage-h2 text-[var(--h-text)]">
              Five people who carried it
            </h2>
            <p className="heritage-body mt-4 max-w-[60ch] text-[var(--h-text-muted)]">
              Unrelated branches, distinct crafts, and different continents: a
              small sample of where the name appears in the public record.
            </p>

            <div className="mt-12 border-t border-[var(--h-rule)]">
              {BEARERS.map((person) => (
                <article
                  key={person.name}
                  className="grid gap-4 border-b border-[var(--h-rule)] py-8 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] md:gap-12"
                >
                  <div>
                    <h3 className="heritage-serif heritage-body font-semibold text-[var(--h-text)]">
                      {person.name}
                    </h3>
                    <p className="heritage-sans heritage-sm heritage-tabular mt-1 text-[var(--h-accent)] font-medium">
                      {person.dates}
                    </p>
                    <p className="heritage-sans heritage-sm mt-1 text-[var(--h-text-muted)]">
                      {person.field}
                    </p>
                  </div>
                  <p className="heritage-body max-w-[60ch] text-[var(--h-text)]">
                    {person.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer & Colophon */}
      <footer className="border-t border-[var(--h-rule)] bg-[var(--h-page)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start md:gap-12">
            <div>
              <p className="heritage-sans heritage-sm font-medium text-[var(--h-text)]">
                About the crest on the front page
              </p>
              <p className="heritage-sans heritage-sm mt-2 text-[var(--h-text-muted)]">
                Entirely invented. Heraldry calls a visual pun on a name canting
                arms: a pond for <em>Teich</em>, a heron, and a Latin motto (
                <em>Ex aqua vita</em>) made up for fun, because a domain ought
                to have something waiting at the door.
              </p>
            </div>

            <div>
              <p className="heritage-sans heritage-sm font-medium text-[var(--h-text)]">
                Sources and reference works
              </p>
              <p className="heritage-sans heritage-sm mt-2 text-[var(--h-text-muted)]">
                Etymology drawn from Wolfgang Pfeifer&apos;s{" "}
                <em>Etymologisches Wörterbuch des Deutschen</em> (via DWDS).
                Surname distribution and origins drawn from the{" "}
                <em>Digitales Familiennamenwörterbuch Deutschlands</em> (DFD),
                Alexander Beider&apos;s dictionaries of Ashkenazi surnames from
                Galicia and the Kingdom of Poland, and historical documentation
                on the 1787 Habsburg <em>Patent über die Judennamen</em>.
              </p>
            </div>

            <div className="heritage-sans heritage-sm md:pt-0.5">
              <Link
                href="/"
                className="heritage-link border-b border-[var(--h-rule)] pb-0.5 text-[var(--h-text-muted)] hover:border-[var(--h-accent)] hover:text-[var(--h-accent)]"
              >
                Return home
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
