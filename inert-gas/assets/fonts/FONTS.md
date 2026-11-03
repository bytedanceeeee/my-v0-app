# Bundled fonts (all SIL Open Font License, latin subset, variable woff2)

These files are ready to use. NOTHING is loaded from the internet (the site's security policy forbids it).
The build embeds only the files that `src/web/style.css` names, up to a budget of 260 KB in total.

| File | Size | Notes |
|---|---|---|
| fraunces-latin-wght-normal.woff2 | 36 KB | Soft, characterful display serif. Axis: weight 100-900 |
| fraunces-latin-wght-italic.woff2 | 45 KB | Italic of the above |
| instrument-serif-latin-400-normal.woff2 | 21 KB | Tall, elegant editorial display (one weight) |
| instrument-serif-latin-400-italic.woff2 | 22 KB | Italic. Lovely for pull-quotes |
| newsreader-latin-wght-normal.woff2 | 58 KB | Reading serif made for long text |
| newsreader-latin-wght-italic.woff2 | 64 KB | Italic |
| bricolage-grotesque-latin-wght-normal.woff2 | 41 KB | Quirky grotesque for headings and buttons |
| inter-tight-latin-wght-normal.woff2 | 45 KB | Neutral UI sans (use only if you must) |
| geist-latin-wght-normal.woff2 | 29 KB | Clean UI sans |
| geist-mono-latin-wght-normal.woff2 | 23 KB | Mono for timestamps, counters, labels |

Use them like this, anywhere in `src/web/style.css`:

```css
@font-face{font-family:"Fraunces";src:url(@font/fraunces-latin-wght-normal.woff2);font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:"Geist Mono";src:url(@font/geist-mono-latin-wght-normal.woff2);font-weight:100 900;font-display:swap}
:root{--serif:"Fraunces",Georgia,serif;--mono:"Geist Mono",ui-monospace,monospace}
```

`url(@font/NAME.woff2)` is replaced by the build with an embedded data: URI. Always keep a system fallback stack.
Latin only: Devanagari (Nepali) text falls back to the system font, so keep a fallback that has Devanagari
(e.g. "Noto Sans Devanagari", "Mangal", system-ui). Do not use font sizes or letter-spacing that break Devanagari.
Suggested budget: at most 3 families, e.g. one display serif (+ italic), one UI sans, one mono (about 100-150 KB).
