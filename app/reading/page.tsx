import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import ReadingRoom from "./reading-room";
import "./reading.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-reading-display",
});

const bodyFont = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-reading-body",
});

export const metadata: Metadata = {
  title: "Reading — Oren Teich",
  description: "The books I've read that left an impact, and the to-read pile that will.",
  openGraph: {
    title: "Reading — Oren Teich",
    description: "The books I've read that left an impact, and the to-read pile that will.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reading — Oren Teich",
    description: "The books I've read that left an impact, and the to-read pile that will.",
  },
};

export default function ReadingPage() {
  return (
    <div className={`${displayFont.variable} ${bodyFont.variable}`}>
      <ReadingRoom />
    </div>
  );
}
