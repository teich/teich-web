export type ReadingStatus = "read" | "to-read";

export type ReadingShelf =
  | "Origins & the Living World"
  | "Myth, Spirit & Meaning"
  | "Modern Systems & Their Discontents"
  | "Mind, Self & Formation"
  | "Power, History & Society"
  | "Work, Judgment & Organizations"
  | "Speculative Fiction";

export type Book = {
  title: string;
  author: string;
  status: ReadingStatus;
  shelf: ReadingShelf;
  /** Date finished, as YYYY, YYYY-MM, or YYYY-MM-DD. */
  dateRead?: string;
  note?: string;
  aliases?: string[];
  mentionedIn?: {
    title: string;
    href: string;
  }[];
};

export const shelfOrder: ReadingShelf[] = [
  "Origins & the Living World",
  "Myth, Spirit & Meaning",
  "Mind, Self & Formation",
  "Modern Systems & Their Discontents",
  "Power, History & Society",
  "Work, Judgment & Organizations",
  "Speculative Fiction",
];

export function slugForBook(book: Pick<Book, "title" | "author">) {
  return `${book.title}-${book.author}`
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function bookshopSearchUrl(book: Pick<Book, "title" | "author">) {
  return `https://bookshop.org/search?keywords=${encodeURIComponent(
    `${book.title} ${book.author}`,
  )}`;
}

const modernConsciousness = {
  title: "The Shape of Modern Consciousness",
  href: "/writing/modern-conciousness",
};

export const books: Book[] = [
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "2011",
    note: "What are humans? How did we get here, evolutionarily?",
  },
  {
    title: "Myths to Live By",
    author: "Joseph Campbell",
    status: "read",
    shelf: "Myth, Spirit & Meaning",
    note: "Joseph Campbell is in a class of his own: myths of humanity, and the truths underneath them.",
  },
  {
    title: "The Hero with a Thousand Faces",
    author: "Joseph Campbell",
    status: "read",
    shelf: "Myth, Spirit & Meaning",
    note: "Not an easy read, and well worth getting through.",
  },
  {
    title: "The Path to Power",
    author: "Robert A. Caro",
    status: "read",
    shelf: "Power, History & Society",
    note: "The best biography ever written. Book 1 in Caro's LBJ series; a study of power and how it is wielded.",
  },
  {
    title: "Tribe",
    author: "Sebastian Junger",
    status: "read",
    shelf: "Power, History & Society",
    aliases: ["Tribe: On Homecoming and Belonging"],
  },
  {
    title: "Man's Search for Meaning",
    author: "Viktor E. Frankl",
    status: "read",
    shelf: "Myth, Spirit & Meaning",
    dateRead: "2014-06-06",
    note: "First half Holocaust memoir, second half Frankl's philosophy. Very hard to read, and very worthwhile.",
  },
  {
    title: "Religion for Atheists",
    author: "Alain de Botton",
    status: "read",
    shelf: "Myth, Spirit & Meaning",
    note: "Religion is so much more than belief in God: community, connection, spirituality.",
    aliases: [
      "Religion for Atheists: A Non-Believer's Guide to the Uses of Religion",
    ],
  },
  {
    title: "The Omnivore's Dilemma",
    author: "Michael Pollan",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "2006",
    note: "I didn't know how to eat for weeks after reading this.",
    aliases: ["Omnivore's Dilemma"],
  },
  {
    title: "Flow",
    author: "Mihaly Csikszentmihalyi",
    status: "read",
    shelf: "Mind, Self & Formation",
    note: "Flow is an apex emotional state, something we strive for in much of life.",
    aliases: ["Flow: The Psychology of Optimal Experience"],
  },
  {
    title: "A Short History of Nearly Everything",
    author: "Bill Bryson",
    status: "read",
    shelf: "Origins & the Living World",
    note: "A fun book. Who doesn't want to know the history of everything?",
  },
  {
    title: "The Meaning of Human Existence",
    author: "Edward O. Wilson",
    status: "read",
    shelf: "Origins & the Living World",
    note: "An evolutionary look at why we are who we are.",
    aliases: ["Meaning of Human Existence"],
  },
  {
    title: "The Beginning of Infinity",
    author: "David Deutsch",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "2024-12",
    note: "Explanations, not observation, tradition, or authority are the engine of unbounded human progress, and that there is no principled limit to what we can come to understand.",
  },
  {
    title: "The WEIRDest People in the World",
    author: "Joseph Henrich",
    status: "to-read",
    shelf: "Origins & the Living World",
  },
  {
    title: "Waking Up",
    author: "Sam Harris",
    status: "read",
    shelf: "Myth, Spirit & Meaning",
    note: "An ardent atheist on the role meditation and spirituality play in his life.",
    aliases: ["Waking Up: A Guide to Spirituality Without Religion"],
  },
  {
    title: "Writing Down the Bones",
    author: "Natalie Goldberg",
    status: "read",
    shelf: "Mind, Self & Formation",
    dateRead: "2013-07-23",
    note: "Writing as connection, meditation, and self-discovery. Want to start writing? Start here.",
    aliases: ["Writing Down the Bones: Freeing the Writer Within"],
  },
  {
    title: "Four Thousand Weeks",
    author: "Oliver Burkeman",
    status: "read",
    shelf: "Mind, Self & Formation",
    aliases: ["Four Thousand Weeks: Time Management for Mortals"],
  },
  {
    title: "Competing Against Luck",
    author: "Clayton M. Christensen",
    status: "read",
    shelf: "Work, Judgment & Organizations",
    note: "Jobs To Be Done, well explained. Short and useful.",
  },
  {
    title: "The Advantage",
    author: "Patrick Lencioni",
    status: "read",
    shelf: "Work, Judgment & Organizations",
    note: "Organizational health matters. If you don't have a great team, you don't have anything.",
    aliases: [
      "The Advantage: Why Organizational Health Trumps Everything Else In Business",
    ],
  },
  {
    title: "Fooled by Randomness",
    author: "Nassim Nicholas Taleb",
    status: "read",
    shelf: "Work, Judgment & Organizations",
    note: "Humans find patterns, even when there isn't one.",
    aliases: ["Fooled By Randomness"],
  },
  {
    title: "Technological Revolutions and Financial Capital",
    author: "Carlota Perez",
    status: "read",
    shelf: "Modern Systems & Their Discontents",
    dateRead: "2014-02-13",
    note: "Perez maps a recurring 50-to-60-year pattern in which each technological revolution moves through installation, financial bubble, crash, and then a golden age of deployment once institutions catch up, giving you a framework that makes the present moment in AI legible rather than unprecedented.",
    aliases: [
      "Technological Revolutions and Financial Capital: The Dynamics of Bubbles and Golden Ages",
    ],
  },
  {
    title: "The Checklist Manifesto",
    author: "Atul Gawande",
    status: "read",
    shelf: "Work, Judgment & Organizations",
    note: "We are forgetful and mistake-prone. Checklists help us catch ourselves.",
  },
  {
    title: "The Enemy Papers",
    author: "Barry B. Longyear",
    status: "read",
    shelf: "Speculative Fiction",
    note: "Stunning. Best of this list.",
    aliases: ["Enemy Papers"],
  },
  {
    title: "Across Realtime",
    author: "Vernor Vinge",
    status: "read",
    shelf: "Speculative Fiction",
    note: "Two novellas in one binding, and some of my favorite Vinge.",
  },
  {
    title: "Snow Crash",
    author: "Neal Stephenson",
    status: "read",
    shelf: "Speculative Fiction",
    note: "Religion, swords, VR. A bit dated, and well worth reading.",
  },
  {
    title: "Nexus",
    author: "Ramez Naam",
    status: "read",
    shelf: "Speculative Fiction",
    note: "Buddhism, meditation, and enhanced humans. Not literature, but relevant and mind-expanding.",
  },
  {
    title: "The First Fifteen Lives of Harry August",
    author: "Claire North",
    status: "read",
    shelf: "Speculative Fiction",
    note: "A great book regardless of genre.",
    aliases: ["First Fifteen Lives of Harry August"],
  },
  {
    title: "The Rook",
    author: "Daniel O'Malley",
    status: "read",
    shelf: "Speculative Fiction",
    note: "So good.",
  },
  {
    title: "Against the Machine: On the Unmaking of Humanity",
    author: "Paul Kingsnorth",
    status: "read",
    shelf: "Modern Systems & Their Discontents",
    dateRead: "2026-04",
    aliases: ["Against the Machine"],
    mentionedIn: [modernConsciousness],
    note: "Names the thing. Industrial modernity is not a set of problems to solve but a coherent machine systematically dissolving the human, the sacred, and the particular, written with the moral clarity of someone who stopped looking for a way to fix it and started asking how to stay human inside it.",
  },
  {
    title: "Savage Gods",
    author: "Paul Kingsnorth",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
  },
  {
    title: "Ishmael",
    author: "Daniel Quinn",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "1996",
    mentionedIn: [modernConsciousness],
    note: "Directionally true, mythically overstated. The core insight that agriculture ruptured human self-understanding still lands.",
  },
  {
    title: "Braiding Sweetgrass",
    author: "Robin Wall Kimmerer",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "2025",
    mentionedIn: [modernConsciousness],
    note: "Braids Indigenous knowledge, botany, and gratitude into the clearest argument that the natural world is a web of relationships, not a pile of resources.",
  },
  {
    title: "Escape from Freedom",
    author: "Erich Fromm",
    status: "read",
    shelf: "Mind, Self & Formation",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "The Power of Myth",
    author: "Joseph Campbell",
    status: "read",
    shelf: "Myth, Spirit & Meaning",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "Iron John",
    author: "Robert Bly",
    status: "read",
    shelf: "Mind, Self & Formation",
    dateRead: "2015",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "Courting the Wild Twin",
    author: "Martin Shaw",
    status: "to-read",
    shelf: "Myth, Spirit & Meaning",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "Smoke Hole",
    author: "Martin Shaw",
    status: "to-read",
    shelf: "Myth, Spirit & Meaning",
  },
  {
    title: "Why Liberalism Failed",
    author: "Patrick Deneen",
    status: "read",
    shelf: "Modern Systems & Their Discontents",
    dateRead: "2026-04-21",
    mentionedIn: [modernConsciousness],
    note: "The unencumbered, choosing self corrodes the very families, communities, and traditions that made self-government possible. The thesis is genuinely important, though Deneen himself has become reactionary in ways the book itself doesn't require or endorse.",
  },
  {
    title: "Hospicing Modernity",
    author: "Vanessa Machado de Oliveira",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
    aliases: [
      "Hospicing Modernity: Facing Humanity's Wrongs and the Implications for Social Activism",
    ],
  },
  {
    title: "The Spell of the Sensuous",
    author: "David Abram",
    status: "to-read",
    shelf: "Origins & the Living World",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "Sand Talk",
    author: "Tyson Yunkaporta",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "2025",
    note: "Aboriginal thought as a lens to dismantle modern systems thinking from the outside in — less a book than a reorientation of how knowledge itself is structured.",
  },
  {
    title: "The Master and His Emissary",
    author: "Iain McGilchrist",
    status: "to-read",
    shelf: "Mind, Self & Formation",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "Tools for Conviviality",
    author: "Ivan Illich",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
  },
  {
    title: "Shop Class as Soulcraft",
    author: "Matthew B. Crawford",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
  },
  {
    title: "Seeing Like a State",
    author: "James C. Scott",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
  },
  {
    title: "The Unsettling of America",
    author: "Wendell Berry",
    status: "to-read",
    shelf: "Origins & the Living World",
  },
  {
    title: "Re-Visioning Psychology",
    author: "James Hillman",
    status: "to-read",
    shelf: "Mind, Self & Formation",
  },
  {
    title: "The Culture of Narcissism",
    author: "Christopher Lasch",
    status: "to-read",
    shelf: "Mind, Self & Formation",
  },
  {
    title: "Wisdom of the Mythtellers",
    author: "Sean Kane",
    status: "to-read",
    shelf: "Myth, Spirit & Meaning",
  },
  {
    title: "The Sacred and the Profane",
    author: "Mircea Eliade",
    status: "to-read",
    shelf: "Myth, Spirit & Meaning",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "The Technological Society",
    author: "Jacques Ellul",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "The Abolition of Man",
    author: "C. S. Lewis",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
    aliases: ["The Abolition of Man"],
    mentionedIn: [modernConsciousness],
  },
  {
    title: "After Virtue",
    author: "Alasdair MacIntyre",
    status: "to-read",
    shelf: "Modern Systems & Their Discontents",
    mentionedIn: [modernConsciousness],
  },
  {
    title: "The Quest for Community",
    author: "Robert Nisbet",
    status: "to-read",
    shelf: "Power, History & Society",
    aliases: [
      "The Quest for Community: A Study in the Ethics of Order and Freedom",
    ],
  },
  {
    title: "A World Appears",
    author: "Michael Pollan",
    status: "read",
    shelf: "Origins & the Living World",
    dateRead: "2026",
    mentionedIn: [modernConsciousness],
    note: "Why does thinking feel like anything?",
  },
  {
    title: "Nature and Madness",
    author: "Paul Shepard",
    status: "to-read",
    shelf: "Origins & the Living World",
  },
  {
    title: "The Tender Carnivore and the Sacred Game",
    author: "Paul Shepard",
    status: "to-read",
    shelf: "Origins & the Living World",
  },
  {
    title: "Confessions of an Economic Hit Man",
    author: "John Perkins",
    status: "read",
    shelf: "Power, History & Society",
    note: "3rd edition. Insider account of how the US uses development loans, rigged forecasts, and corporate consultants to convert sovereign nations into economic vassals — anecdotal and self-aggrandizing in places, but the mechanism it describes is real.",
  },
  {
    title: "The Shock Doctrine",
    author: "Naomi Klein",
    status: "to-read",
    shelf: "Power, History & Society",
  },
  {
    title: "Globalization and Its Discontents",
    author: "Joseph E. Stiglitz",
    status: "read",
    shelf: "Power, History & Society",
  },
  {
    title: "Blindsight",
    author: "Peter Watts",
    status: "read",
    shelf: "Speculative Fiction",
    note: "Asks whether consciousness is an evolutionary dead end — a costly, parasitic overlay on cognition that truly alien intelligence would shed",
  },
  {
    title: "The Forever War",
    author: "Joe Haldeman",
    status: "read",
    shelf: "Speculative Fiction",
  },
  {
    title: "Accelerando",
    author: "Charles Stross",
    status: "read",
    shelf: "Speculative Fiction",
    note: "Tracks three generations of a family through the Singularity, from near-future gig-economy hustler to post-human descendants negotiating with the disassembled remains of the solar system — dense, dated in spots, and still the most vivid depiction of runaway intelligence in fiction.",
  },
  {
    title: "Glasshouse",
    author: "Charles Stross",
    status: "read",
    shelf: "Speculative Fiction",
  },
  {
    title: "The Robots of Dawn",
    author: "Isaac Asimov",
    status: "read",
    shelf: "Speculative Fiction",
  },
  {
    title: "Altered Carbon",
    author: "Richard K. Morgan",
    status: "read",
    shelf: "Speculative Fiction",
  },
  {
    title: "The Windup Girl",
    author: "Paolo Bacigalupi",
    status: "read",
    shelf: "Speculative Fiction",
  },
  {
    title: "The City and the Stars",
    author: "Arthur C. Clarke",
    status: "read",
    shelf: "Speculative Fiction",
  },
];

export const readingByTitle = new Map<string, Book>(
  books.flatMap((book) => [
    [book.title, book] as const,
    ...(book.aliases ?? []).map((alias) => [alias, book] as const),
  ]),
);
