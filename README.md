# teich.net

Homepage for the Teich family, featuring historical research on the surname's etymology, migration patterns, and a custom family crest.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

- `/` - Home page with family crest
- `/heritage` - Comprehensive historical and genealogical study of the Teich surname
- `/crest` - Detailed explanation of the family crest symbolism
- `/writing` - Essay index
- `/writing/modern-conciousness` - The Shape of Modern Consciousness
- `/writing/formation-of-boys` - The Formation of Boys
- `/reading` - Reading list with essay references

## Reading list

Books live in `content/reading-list.ts`. After adding one, run `npm run covers` to
fetch its cover into `public/covers/` and record its size, spine colour and page
count in `content/covers.json`. If the wrong edition turns up, pin a source in
`content/cover-sources.json` and run `npm run covers -- --only=<slug>`. A book
with no cover still renders, with a typeset cloth cover.

The page (`app/reading/`) lays everything out in ordinary HTML and CSS. Where
WebGPU is available, `gpu/engine.ts` draws each book as a lit 3D object on a
canvas over the page, reading its position from the layout; elsewhere the same
slots show plain cover images.
