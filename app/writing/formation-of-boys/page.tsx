import type { Metadata } from "next";
import EssayPage from "../essay-page";

export const metadata: Metadata = {
  title: "The Formation of Boys",
  description:
    "An essay on boys, formation, masculinity, and the local work of helping boys become men.",
};

export default function FormationOfBoysPage() {
  return <EssayPage essayFileName="the-formation-of-boys.md" />;
}
