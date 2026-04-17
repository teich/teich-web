import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import ReadingList from "./reading-list";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-reading-display",
});

const bodyFont = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-reading-body",
});

export const metadata: Metadata = {
  title: "Reading List",
  description: "Books Oren has read, loved, and plans to read.",
};

export default function ReadingPage() {
  return (
    <main
      className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-[#f4efe5] text-stone-800`}
      style={{ fontFamily: "var(--font-reading-body)" }}
    >
      <ReadingList />
    </main>
  );
}
