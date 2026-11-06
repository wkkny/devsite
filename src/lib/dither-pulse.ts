/**
 * A ring sent through every dither canvas from a point on screen, even one outside the canvas.
 * Speed is in CSS pixels per second, so a ring can keep pace with something else on the page.
 */
export type DitherPulse = {
  clientX: number
  clientY: number
  speed?: number
  strength?: number
  boost?: number
  duration?: number
}

export const DITHER_PULSE_EVENT = 'dither:pulse'

export function sendDitherPulse(pulse: DitherPulse) {
  window.dispatchEvent(new CustomEvent<DitherPulse>(DITHER_PULSE_EVENT, { detail: pulse }))
}
