import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: "rgb(245, 245, 240)" }}
    >
      <Link href="/heritage">
        <Image
          src="/teich-crest.jpg"
          alt="Teich Crest"
          width={500}
          height={500}
          priority
          className="cursor-pointer hover:opacity-90 transition-opacity"
        />
      </Link>
    </div>
  );
}
