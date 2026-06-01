import type { Metadata } from "next";
import EssayPage from "../essay-page";

export const metadata: Metadata = {
  title: "The Shape of Modern Consciousness",
  description:
    "An essay on modernity, perception, myth, and the shape of consciousness.",
};

export default function ModernConsciousnessPage() {
  return <EssayPage essayFileName="the-shape-of-modern-consciousness.md" />;
}
