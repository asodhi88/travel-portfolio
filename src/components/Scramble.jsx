import { useEffect, useState } from 'react'

const FRAME_MS = 40

/* Letters grouped by how much room they take in a proportional face. A
   paragraph's line breaks are decided by the sum of its glyph widths, so
   swapping every letter for a random one changes that sum enough to gain or
   lose a line — the text below it then jumps as the decode finishes. Replacing
   like with like keeps the total near enough that the wrap holds still. */
const NOISE = [
  { of: 'ilj', from: 'ilj' },
  { of: 'ftr', from: 'ftrj' },
  { of: 'mw', from: 'mw' },
  { of: 'abcdeghknopqsuvxyz', from: 'acegknopsuvxyz' },
  { of: 'IJ', from: 'IJT' },
  { of: 'MW', from: 'MW' },
  // Digits ride along with the capitals — they're about the same width, and
  // they're what gives the headline its ticker-tape look.
  { of: 'ABCDEFGHKLNOPQRSTUVXYZ', from: 'ABCDEGHKNOPQRSUVXYZ0123456789' },
  { of: '0123456789', from: '0123456789' },
]

const pick = (set) => set[Math.floor(Math.random() * set.length)]

/**
 * A stand-in of roughly the same shape as the character it replaces.
 *
 * This is what makes the effect usable on prose rather than just on a headline.
 * Spaces and punctuation are left alone, so words keep their boundaries and
 * their lengths; case is preserved, so a lowercase run never fills with
 * capitals; and width is preserved, so the line breaks don't shuffle on every
 * frame. Anything the buckets don't cover is left as it is.
 */
function noiseFor(character) {
  const bucket = NOISE.find((group) => group.of.includes(character))
  return bucket ? pick(bucket.from) : character
}

const scrambleAll = (text) => text.split('').map(noiseFor).join('')

/**
 * Text that decodes into place: every character cycles through noise, settling
 * left to right until the real string is left.
 *
 * Rendered as its own component so a run re-renders only itself — the page
 * around it, and any other block decoding at the same time, stay put.
 *
 * @param {{
 *   text: string,
 *   active: boolean,        // false renders the settled text and runs nothing
 *   delayMs?: number,       // wait before the run starts
 *   durationMs: number,     // time to settle the whole string
 *   holdLayout?: boolean    // show noise while waiting, instead of nothing, so
 *                           // a block in the page's flow keeps its height
 * }} props
 */
export default function Scramble({
  text,
  active,
  delayMs = 0,
  durationMs,
  holdLayout = false,
}) {
  const [value, setValue] = useState(text)

  useEffect(() => {
    if (!active) {
      setValue(text)
      return undefined
    }

    setValue(holdLayout ? scrambleAll(text) : '')

    const totalFrames = Math.max(1, Math.round(durationMs / FRAME_MS))
    let frame = 0
    let interval = null

    const timer = setTimeout(() => {
      interval = setInterval(() => {
        frame += 1
        const settled = Math.floor((frame / totalFrames) * text.length)

        if (settled >= text.length) {
          setValue(text)
          clearInterval(interval)
          return
        }

        setValue(
          text
            .split('')
            .map((character, i) => (i < settled ? character : noiseFor(character)))
            .join('')
        )
      }, FRAME_MS)
    }, delayMs)

    return () => {
      clearTimeout(timer)
      if (interval) clearInterval(interval)
    }
  }, [text, active, delayMs, durationMs, holdLayout])

  return value
}
