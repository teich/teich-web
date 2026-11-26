// Canvas-drawn textures: a lettered spine for every book, and a plain cloth
// cover for any book that has no cover image yet.

type Printable = {
  title: string;
  author: string;
  aspect: number;
  thick: number;
  color: [number, number, number];
};

const css = ([r, g, b]: [number, number, number], scale = 1) =>
  `rgb(${Math.round(r * 255 * scale)} ${Math.round(g * 255 * scale)} ${Math.round(b * 255 * scale)})`;

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function inkFor(color: [number, number, number]) {
  return luminance(color) > 0.52 ? "rgb(32 27 22 / 0.9)" : "rgb(247 240 224 / 0.94)";
}

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** The spine as seen with the front cover to the right: title running down,
 *  letter tops toward the front, author at the foot. */
export function drawSpine(book: Printable, width: number, height: number, family: string) {
  const canvas = surface(width, height);
  const ctx = canvas.getContext("2d")!;
  const title = book.title.split(":")[0];
  const surname = book.author.split(" ").at(-1) ?? "";
  // Work in units where the spine is `height` tall and its true width wide,
  // then let the canvas stretch that across the texture.
  const real = Math.max(8, height * book.thick * book.aspect);
  ctx.fillStyle = css(book.color);
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(width / real, 0, 0, 1, 0, 0);

  const ink = inkFor(book.color);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(real * 0.16, height * 0.045, real * 0.68, 1.5);
  ctx.fillRect(real * 0.16, height * 0.955, real * 0.68, 1.5);
  ctx.globalAlpha = 1;

  ctx.translate(real / 2, 0);
  ctx.rotate(Math.PI / 2);
  ctx.textBaseline = "middle";

  let size = Math.min(real * 0.56, 40);
  const room = height * 0.6;
  ctx.font = `600 ${size}px ${family}`;
  const measured = ctx.measureText(title).width;
  if (measured > room) size *= room / measured;
  ctx.font = `600 ${size}px ${family}`;
  ctx.textAlign = "left";
  ctx.fillText(title, height * 0.075, size * 0.04);

  if (real > 13) {
    const small = Math.max(9, Math.min(size * 0.62, real * 0.34));
    ctx.font = `500 ${small}px ${family}`;
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.82;
    ctx.fillText(surname.toUpperCase(), height * 0.925, small * 0.04, height * 0.2);
  }
  return canvas;
}

/** A typeset cloth cover: jacket colour, a ruled frame, title and author. */
export function drawCloth(book: Printable, width: number, height: number, family: string) {
  const canvas = surface(width, height);
  const ctx = canvas.getContext("2d")!;
  // The texture is stretched to the book's real proportions, so set type in
  // those proportions.
  const real = height * book.aspect;
  ctx.fillStyle = css(book.color);
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(width / real, 0, 0, 1, 0, 0);

  const ink = inkFor(book.color);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  const inset = real * 0.07;
  ctx.strokeRect(inset, inset, real - inset * 2, height - inset * 2);
  ctx.globalAlpha = 1;

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const size = real * 0.115;
  ctx.font = `500 ${size}px ${family}`;
  const lines: string[] = [];
  let line = "";
  for (const word of book.title.split(":")[0].split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > real * 0.72) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  lines.forEach((text, i) => ctx.fillText(text, real / 2, height * 0.3 + i * size * 1.12));

  ctx.font = `italic 400 ${size * 0.6}px ${family}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(book.author, real / 2, height * 0.84, real * 0.76);
  return canvas;
}
