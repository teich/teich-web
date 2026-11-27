// Canvas-drawn textures: a lettered spine for every book, and a plain cloth
// cover for any book that has no cover image yet.

type Printable = {
  title: string;
  author: string;
  subtitle?: string;
  shelf?: string;
  statusLine?: string;
  note?: string;
  aspect: number;
  thick: number;
  color: [number, number, number];
};

const css = ([r, g, b]: [number, number, number], scale = 1) =>
  `rgb(${Math.round(r * 255 * scale)} ${Math.round(g * 255 * scale)} ${Math.round(b * 255 * scale)})`;

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function inkRgb(color: [number, number, number]): [number, number, number] {
  return luminance(color) > 0.52 ? [32, 27, 22] : [247, 240, 224];
}

function inkFor(color: [number, number, number], alpha?: number) {
  const [r, g, b] = inkRgb(color);
  const a = alpha ?? (luminance(color) > 0.52 ? 0.9 : 0.94);
  return `rgb(${r} ${g} ${b} / ${a})`;
}

/** Turn a dark-on-light crest image into an alpha mask tinted to the cloth ink. */
export function makeCrestStamp(image: HTMLImageElement, color: [number, number, number]) {
  const w = 160;
  const h = Math.round((w * image.naturalHeight) / Math.max(1, image.naturalWidth));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const [ir, ig, ib] = inkRgb(color);
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    // Map dark ink lines to opaque and pale paper background to transparent.
    const a = Math.max(0, Math.min(1, (0.82 - lum) / 0.58));
    px[i] = ir;
    px[i + 1] = ig;
    px[i + 2] = ib;
    px[i + 3] = Math.round(a * a * 220);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function surface(width: number, height: number, target?: HTMLCanvasElement) {
  const canvas = target ?? document.createElement("canvas");
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return canvas;
}

/** The spine as seen with the front cover to the right: title running down,
 *  letter tops toward the front, author at the foot. */
export function drawSpine(
  book: Printable,
  width: number,
  height: number,
  family: string,
  target?: HTMLCanvasElement,
) {
  const canvas = surface(width, height, target);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
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
export function drawCloth(
  book: Printable,
  width: number,
  height: number,
  family: string,
  target?: HTMLCanvasElement,
) {
  const canvas = surface(width, height, target);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line) {
    const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length + line.split(/\s+/).length;
    if (usedWords < words.length) {
      let clipped = line;
      while (clipped.length > 4 && ctx.measureText(`${clipped}…`).width > maxWidth) {
        clipped = clipped.slice(0, -1).trimEnd();
      }
      lines.push(`${clipped}…`);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** A cloth back cover stamped with Oren's note and an ex libris Teich crest. */
export function drawBackCover(
  book: Printable,
  width: number,
  height: number,
  displayFamily: string,
  bodyFamily: string,
  crest?: HTMLImageElement | null,
  target?: HTMLCanvasElement,
) {
  const canvas = surface(width, height, target);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  const real = height * book.aspect;

  // Cloth base with a subtle vertical shading gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, css(book.color, 1.03));
  grad.addColorStop(1, css(book.color, 0.92));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(width / real, 0, 0, 1, 0, 0);

  // Double hairline cloth frame.
  const inset = real * 0.068;
  ctx.strokeStyle = inkFor(book.color, 0.42);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inset, inset, real - inset * 2, height - inset * 2);
  ctx.strokeStyle = inkFor(book.color, 0.22);
  ctx.lineWidth = 0.9;
  const inner = inset + 7;
  ctx.strokeRect(inner, inner, real - inner * 2, height - inner * 2);

  // Shelf header at top.
  ctx.fillStyle = inkFor(book.color, 0.66);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (book.shelf) {
    const labelSize = Math.max(11, real * 0.029);
    ctx.font = `500 ${labelSize}px ${displayFamily}`;
    ctx.fillText(book.shelf.toUpperCase(), real / 2, height * 0.125, real * 0.72);
    ctx.fillStyle = inkFor(book.color, 0.28);
    ctx.fillRect(real * 0.36, height * 0.16, real * 0.28, 1);
  }

  // Personal note (pull-quote) or title/subtitle centerpiece.
  const room = real * 0.72;
  ctx.fillStyle = inkFor(book.color, 0.92);
  if (book.note) {
    const quoteSize = Math.max(15, real * 0.048);
    ctx.font = `italic 400 ${quoteSize}px ${bodyFamily}`;
    const lines = wrapLines(ctx, `“${book.note}”`, room, 8);
    const leading = quoteSize * 1.48;
    const blockH = lines.length * leading;
    const startY = height * 0.39 - blockH / 2 + leading * 0.45;
    lines.forEach((l, idx) => ctx.fillText(l, real / 2, startY + idx * leading));
  } else {
    const titleSize = Math.max(20, real * 0.072);
    ctx.font = `italic 400 ${titleSize}px ${displayFamily}`;
    const shortTitle = book.title.split(/:\s+/, 2)[0];
    const lines = wrapLines(ctx, shortTitle, room, 3);
    const leading = titleSize * 1.15;
    const startY = height * 0.36 - (lines.length * leading) / 2 + leading * 0.45;
    lines.forEach((l, idx) => ctx.fillText(l, real / 2, startY + idx * leading));
    const sub = book.subtitle ?? book.author;
    ctx.fillStyle = inkFor(book.color, 0.72);
    ctx.font = `400 ${Math.max(13, real * 0.038)}px ${bodyFamily}`;
    ctx.fillText(sub, real / 2, startY + lines.length * leading + 16, room);
  }

  // Ex libris Teich crest stamp at lower third.
  const crestTop = height * 0.625;
  const crestH = height * 0.165;
  if (crest && crest.naturalWidth > 0) {
    const stamp = makeCrestStamp(crest, book.color);
    const crestW = (crestH * stamp.width) / stamp.height;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(stamp, (real - crestW) / 2, crestTop, crestW, crestH);
    ctx.globalAlpha = 1;
  } else {
    // Crisp diamond ornament while crest loads.
    ctx.strokeStyle = inkFor(book.color, 0.45);
    ctx.lineWidth = 1.2;
    const cy = crestTop + crestH * 0.5;
    ctx.beginPath();
    ctx.moveTo(real / 2, cy - 12);
    ctx.lineTo(real / 2 + 12, cy);
    ctx.lineTo(real / 2, cy + 12);
    ctx.lineTo(real / 2 - 12, cy);
    ctx.closePath();
    ctx.stroke();
  }

  // Ex Libris colophon & status at foot.
  const exSize = Math.max(12, real * 0.034);
  ctx.fillStyle = inkFor(book.color, 0.72);
  ctx.font = `italic 400 ${exSize}px ${displayFamily}`;
  ctx.fillText("Ex Libris · Oren Teich", real / 2, height * 0.835, room);

  if (book.statusLine) {
    ctx.fillStyle = inkFor(book.color, 0.54);
    ctx.font = `400 ${Math.max(11, real * 0.028)}px ${bodyFamily}`;
    ctx.fillText(book.statusLine, real / 2, height * 0.885, room);
  }

  return canvas;
}
