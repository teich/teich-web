import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { library } from "./library";

export const dynamic = "force-static";
export const alt = "Oren Teich's Reading List";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FEATURED_SLUGS = [
  "the-path-to-power-robert-a-caro",
  "the-art-of-pilgrimage-phil-cousineau",
  "the-master-and-his-emissary-iain-mcgilchrist",
  "braiding-sweetgrass-robin-wall-kimmerer",
  "the-beginning-of-infinity-david-deutsch",
];

async function coverDataUri(slug: string) {
  try {
    const file = path.join(process.cwd(), "public", "covers", `${slug}.jpg`);
    const buf = await readFile(file);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const readCount = library.filter((b) => b.status === "read").length;
  const featured = FEATURED_SLUGS.map((slug) => library.find((b) => b.slug === slug)).filter(
    (b): b is (typeof library)[number] => Boolean(b),
  );
  const picks = featured.length >= 4 ? featured : library.slice(0, 5);
  const images = await Promise.all(
    picks.map(async (book) => ({
      slug: book.slug,
      src: await coverDataUri(book.slug),
      color: `rgb(${book.color.map((c) => Math.round(c * 255)).join(",")})`,
    })),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px 52px",
          backgroundColor: "#f3eee3",
          color: "#2a231c",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#6b6154",
            borderBottom: "1px solid rgba(42,35,28,0.14)",
            paddingBottom: 18,
          }}
        >
          <span>Teich</span>
          <span>
            {library.length} books · {readCount} read
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 48,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 470,
              gap: 20,
            }}
          >
            <div
              style={{
                fontSize: 112,
                fontStyle: "italic",
                fontWeight: 400,
                lineHeight: 0.9,
                letterSpacing: "-0.03em",
              }}
            >
              Reading
            </div>
            <div
              style={{
                fontSize: 27,
                lineHeight: 1.45,
                color: "#574e44",
              }}
            >
              The books I’ve read that left an impact, and the to-read pile that will.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 18,
              paddingTop: 12,
            }}
          >
            {images.map((item, idx) => (
              <div
                key={item.slug}
                style={{
                  display: "flex",
                  width: 110,
                  height: 168,
                  borderRadius: 4,
                  overflow: "hidden",
                  backgroundColor: item.color,
                  boxShadow: "0 14px 30px rgba(42, 30, 14, 0.24)",
                  transform: `translateY(${idx % 2 === 0 ? -10 : 12}px)`,
                }}
              >
                {item.src && (
                  <img
                    src={item.src}
                    alt=""
                    width={110}
                    height={168}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
