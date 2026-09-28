import { useLocation } from 'react-router-dom'

// The page art (OHRR, 2026-09-28): a large, faint line drawing at the right of
// each page's blue band — the logo's own bunny on Home (and About), and one
// item for each kind of page everywhere else, all in the same line weight
// (the drawings are public/art/*.svg; the website has the same files). Each is
// a small SVG used as a CSS mask, so it takes the band's colour (white here,
// soft blue on the website) and costs one ~0.3 KB file per page (the bunny ~5
// KB). Decorative: hidden from screen readers, and never makes a band taller.

export type ArtName =
  | 'bunny'
  | 'adopt'
  | 'care'
  | 'give'
  | 'events'
  | 'shop'
  | 'contact'
  | 'volunteer'
  | 'found'
  | 'vets'
  | 'tails'

// First match wins; pages outside these sections keep a plain band.
const SECTIONS: [RegExp, ArtName][] = [
  [/^\/about/, 'bunny'],
  [/^\/(adopt|thinking-about-a-rabbit|appointment)/, 'adopt'],
  [/^\/tails/, 'tails'],
  [/^\/volunteer/, 'volunteer'],
  [/^\/(give|support|impact|info\/legacy-fund)/, 'give'],
  [/^\/(vets|services)/, 'vets'],
  [/^\/(learn|info|my-bunny)/, 'care'],
  [/^\/(events|bunfest)/, 'events'],
  [/^\/hop-shop/, 'shop'],
  [/^\/mailing-list/, 'contact'],
  [/^\/(found|surrender|rescues)/, 'found'],
]

export function artForPath(pathname: string): ArtName | null {
  return SECTIONS.find(([re]) => re.test(pathname))?.[1] ?? null
}

/** The art for the page being shown (null: none). */
export function usePageArt(): ArtName | null {
  return artForPath(useLocation().pathname)
}

/** Position it with `className` (absolute; the colour is `currentColor`). */
export function PageArt({ name, className = '' }: { name: ArtName; className?: string }) {
  const url = `url(/art/${name}.svg)`
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bg-current ${className}`}
      style={{
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'right center',
        maskPosition: 'right center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}
