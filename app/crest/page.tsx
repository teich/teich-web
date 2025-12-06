import Link from "next/link";

export default function Crest() {
  return (
    <div className="min-h-screen py-10 bg-[rgb(246,237,221)] dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 bg-white/80 dark:bg-gray-800 rounded-lg shadow-md py-8 dark:text-gray-200">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold mb-4">The Teich Family Crest</h1>
          <div className="flex justify-center gap-4 mb-6">
            <Link href="/" className="text-blue-600 hover:underline">Return to Home</Link>
            <span className="text-gray-400">|</span>
            <Link href="/heritage" className="text-blue-600 hover:underline">View Heritage Page</Link>
          </div>
        </header>

        <div className="flex justify-center mb-8">
          <img src="/teich-crest.jpg" alt="Teich Family Crest" className="max-w-md rounded-lg shadow-lg" />
        </div>

        <section className="mb-10">
          <p className="mb-6 text-lg">
            The Teich family crest is a visual representation of the family's heritage, etymology, and the remarkable journey from Austria to Palestine in 1937. Each element of the crest carries deep symbolic meaning, weaving together the story of the name itself with the family's historical migration.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-8">1. The Literal Name: Teich (The Pond)</h2>
          <p className="mb-4">
            The central anchor of the shield—the bottom point—features a calm pool of water. <strong>Teich</strong> is the German word for "pond" or "pool." In heraldry, using a visual pun on the name is called "canting arms." Standing in the water is a <strong>heron</strong>, the guardian of the pond. Herons symbolize quiet patience, vigilance, and the ability to thrive in one's natural element.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-8">2. The Austrian Heritage</h2>
          <p className="mb-4">
            The top right quadrant honors the family's Austrian origins before 1937. <strong>Snow-capped mountains</strong> represent the Austrian Alps, set against a blue sky. Above the mountains, a <strong>dove</strong> flies, representing peace and the flight from persecution—a search for a safe place to land.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-8">3. The Migration</h2>
          <p className="mb-4">
            The top left quadrant features a <strong>sailing vessel</strong> navigating choppy waters, representing the brave and perilous journey taken in 1937. Leaving Europe just before the onset of World War II was a life-saving decision. The ship symbolizes the passage from the old world to the new, crossing the Mediterranean Sea to reach safety.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-8">4. The Roots in Palestine</h2>
          <p className="mb-4">
            The bottom half of the shield is bathed in gold, representing the sun and warmth of the Middle East, contrasting with the blue and cool tones of the European top half. Flanking the water are a <strong>palm tree</strong> and an <strong>olive tree</strong>—quintessentially Mediterranean symbols of the land where the next generation was born in 1940. The olive tree specifically represents peace and endurance (survival in harsh conditions), while the palm signifies victory over adversity.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-8">5. The Colors</h2>
          <p className="mb-4">
            <strong>Azure (Blue):</strong> Represents the water of the "Teich," as well as truth and loyalty.
          </p>
          <p className="mb-4">
            <strong>Or (Gold):</strong> Represents generosity and elevation of the mind. It also visually represents the transition from the cold climate of Austria to the sun of the Levant.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-8">6. The Motto: Ex Aqua Vita</h2>
          <p className="mb-4">
            The Latin motto on the ribbon below reads <strong>"Ex Aqua Vita"</strong>—"From Water, Life." This serves a dual meaning: Literally, life springs from the Teich (pond). Historically, the family crossed the water (the Mediterranean) to find a new life, and that crossing brought forth new life in a new land.
          </p>
        </section>
      </div>
    </div>
  );
}
