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
  title: "Reading",
  description: "Books Oren has read, loved, and plans to read.",
};

export default function ReadingPage() {
  return (
    <div className={`${displayFont.variable} ${bodyFont.variable}`}>
      <ReadingRoom />
    </div>
  );
}
