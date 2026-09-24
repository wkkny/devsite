/* Adapted from Bencho's "Dragging ball" component.
   Source and licence: https://bencho.dev/licence

   Copyright (c) 2026 Lorenzo Cabra

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to
   deal in the Software without restriction, including without limitation the
   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
   sell copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
   IN THE SOFTWARE. */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";
import { Liquid } from "liquid-gooey";

/* ══ Dragging ball ════════════════════════════════════════
   One body, deformed by its own speed. A trail would put a
   second circle behind this one, and that reads as exactly
   what it is — a thread while you drag slowly and a detached
   blob when you drag fast. Stretch lengthens the single body
   into its direction of travel instead, so the elasticity
   has nothing to leave behind.

   The ball itself is pinned to the pointer with no lag at
   all. The library draws the changing silhouette around that
   one body and it collapses back into a circle the moment you
   stop.

   ── the rules this obeys ────────────────────────────────
   The bodies are in FLOW, both in one grid cell — an
   absolutely positioned child measures as a zero-radius box
   and the filter draws nothing. The group's fill is OPAQUE,
   because the contrast step erases anything under about 0.39
   alpha. And the layer takes the 1/k correction, because
   `move` measures screen pixels and every card here is drawn
   at a fraction of its size. */

const WELL = { w: 300, h: 200 };

/* ── how the grab reads ────────────────────────────────────
   A ball you can drag and a ball you have to GRAB are the
   same interaction with one thing added: the object has to
   answer the hand before it moves. Three beats, and none of
   them is the drag itself —

     hover   it swells a little, so you know it is live
     press   it PINCHES, narrower and taller, the way a soft
             thing does between two fingers
     let go  it rounds back out on a spring

   The pinch is the one doing the work, and it is a pinch
   rather than a uniform shrink on purpose. A circle that gets
   smaller reads as a button being pressed INTO a surface;
   this one is not on a surface, it is in your hand, and what
   a held ball does is narrow across the grip and bulge along
   it. Area is roughly kept — 0.16 out of the width against
   0.08 into the height — so it reads as squeezed rather than
   as resized.

   It goes on the motion node that owns the press — the span
   here, or the draggable parent when this ball is composed
   into a larger item. The metaball filter reads the child's
   rendered bounds, so the silhouette pinches with it.

   ALL THREE BEATS RIDE THE ONE KNOB, hover included. Grip is
   not "how hard the squeeze is", it is how much the ball
   answers a hand at all — so at 0 it does not swell either,
   and 0 is exactly the block this was before: a circle that
   follows your finger and does nothing else. A knob whose
   bottom end is the old component is the honest kind. */
const SWELL = 0.06;

type BallSound = "lift" | "drop";
export type DraggingBallControls = { grab: () => void; drop: () => void };
type ControlsRef = { current: DraggingBallControls | null };

let audioContext: AudioContext | null = null;

/* Short sine pips keep the two gesture ends audible without
   covering the portfolio's other sounds. */
function play(sound: BallSound) {
  if (typeof window === "undefined" || !window.AudioContext) return;

  try {
    const context = audioContext ?? (audioContext = new AudioContext());
    if (context.state === "suspended") void context.resume().catch(() => {});

    const start = context.currentTime;
    const isLift = sound === "lift";
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(isLift ? 420 : 620, start);
    oscillator.frequency.exponentialRampToValueAtTime(isLift ? 620 : 420, start + 0.08);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.015, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.11);
  } catch {
    /* Audio may be unavailable or disabled by the browser. */
  }
}

/* ── inlined from ./Gooey ──────────────────────── */
/* ══ Gooey ════════════════════════════════════════════════
   What is left of the two library-surfaced components that
   used to live here: the measurement every liquid-gooey group
   on the bench needs. Liquid tabs and the Plus menu are gone;
   this is the part of them that turned out to be the reusable
   half, and Balance, the Selection list, the Humidity wheel
   and the Sleep dial all still call it.

   ── what the library actually does ──────────────────────
   The usual gooey effect runs blur + alpha-contrast over your
   real UI, which is why it is normally confined to decorative
   circles: text goes soft, images smear, and the contrast step
   eats shadows. liquid-gooey splits it in two. An SVG layer
   carries a silhouette of your elements and takes the whole
   filter; your actual DOM rides crisp on top of it, untouched.
   Same liquid, none of the tax — and it is the same discipline
   our own filter needs, since text under an alpha threshold
   loses its edges and then itself.

   ── the two patterns, which are not interchangeable ─────
   MORPH gives the library the position: pass x/y and it
   animates the element and the liquid together, so pieces that
   separate stay bridged until the goo can no longer hold them.
   The split IS the effect.

   MOVE gives the position to you: move the element however you
   like and the surface trails it as liquid rubber with a
   droplet tail. A filter has no memory of motion — a shape
   that crossed two pixels and one that crossed the whole track
   arrive identical — and this is the part that fixes that. */

/* ── the zoom correction, applied to someone else's SVG ──────
   liquid-gooey measures its items with getBoundingClientRect
   and draws them as SVG user units. Those are the same number
   only while no ancestor is scaled — and on this bench every
   component sits inside a scaled card, so the transform lands
   twice and the silhouette drifts from its element in
   proportion to both the scale and the distance from the
   origin. Measured: 0.1px at scale 1, 22px at 1.09, 124px at
   1.4.

   Everything the library computes is in screen px, so scaling
   its layer by 1/k converts the whole coordinate space back to
   layout px in one move, and the card's own transform then
   renders it correctly. Same k = rect.width / offsetWidth the
   rest of the bench uses.

   MOVE ONLY. Morph positions its items with a CSS transform on
   a real wrapper, in layout px, which scales correctly on its
   own — apply this there and you over-correct: the silhouette
   comes out 1/k the size of its button, so the blob is smaller
   than the element and every icon looks off-centre inside it.
   Measured on the plus menu: button 58px, blob 46px, and up to
   10px of offset. Without it, 58 and 58, dead on. */
function useGooScale() {
  const box = useRef<HTMLDivElement | null>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const next = (r.width / (el.offsetWidth || r.width)) || 1;
      setK((was) => (Math.abs(was - next) < 0.001 ? was : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    /* the card also rescales when the overlay opens, which is a
       transform change and not a resize */
    const t = window.setInterval(read, 500);
    return () => { ro.disconnect(); window.clearInterval(t); };
  }, []);
  return { box, k };
}

type Well = { w: number; h: number };

export function DraggingBall({
  /* how much the body deforms with its own speed, 0..100 */
  stretch = 36,
  /* how quickly it recovers its shape, 0..100 */
  give = 50,
  /* the ball, px */
  size = 56,
  /* how hard it is squeezed while held, 0..100 — 0 is a rigid
     ball, which is a real setting and is what this was */
  grip = 50,
  well = WELL,
  drag = true,
  externalGestures = false,
  reducedMotion = false,
  controlsRef,
  children,
}: {
  stretch?: number;
  give?: number;
  size?: number;
  grip?: number;
  well?: Well;
  drag?: boolean;
  externalGestures?: boolean;
  reducedMotion?: boolean;
  controlsRef?: ControlsRef;
  children?: ReactNode;
} = {}) {
  const g = Math.min(1, Math.max(0, grip / 100));
  /* the library measures in screen pixels and every card on
     this bench is drawn at a fraction — see the Gooey notes above */
  const { box, k } = useGooScale();

  /* ── one note in, one note out, whichever event brings it ──
     The sounds used to hang off `onDragStart`/`onDragEnd`,
     which means a press that never moves is silent — and a
     press that never moves is exactly the case this component
     just grew a squeeze for. Pointer down is the grab.

     Both handlers are idempotent and both are wired to the
     pointer AND the drag, so whichever framer forwards first
     makes the sound and the other does nothing. That way the
     pair can never go out of balance, and it does not depend
     on knowing which events framer's drag lets through. */
  const armed = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const grab = () => {
    setPressed(true);
    if (armed.current) return;
    armed.current = true;
    play("lift");
  };
  const drop = () => {
    setPressed(false);
    if (!armed.current) return;
    armed.current = false;
    play("drop");
  };

  useLayoutEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = { grab, drop };
    return () => {
      if (controlsRef.current?.grab === grab) controlsRef.current = null;
    };
  });

  /* room to move: half the well less half the ball, so the
     circle can touch each edge and go no further */
  const reach = { x: (well.w - size) / 2, y: (well.h - size) / 2 };
  const externalGesturePose = reducedMotion
    ? { scaleX: 1, scaleY: 1 }
    : pressed
      ? { scaleX: 1 - 0.16 * g, scaleY: 1 + 0.08 * g }
      : hovered
      ? { scaleX: 1 + SWELL * g, scaleY: 1 + SWELL * g }
      : { scaleX: 1, scaleY: 1 };

  return (
    <div
      className="drg-well"
      ref={box}
      style={{ "--k": k, width: well.w, height: well.h } as CSSProperties}
    >
      <Liquid
        className="drg-goo"
        /* small numbers on purpose. The ball is 56px under a
           4.5px blur — twelve to one — which is what keeps the
           silhouette a circle rather than a smudge. */
        blur={4.5}
        contrast={16}
        /* ── THE BALL IS A RAISED SURFACE, NOT INK ────────────
           `--board` is mapped to this project's secondary
           surface in the stylesheet. It keeps the light ball
           near-white and the dark ball raised from the page.
           An ink fill would be a near-black disc that vanished
           on a near-black card, which is the trap the liquid
           toggle fell into twice.

           The name matters because the board is the theme's
           raised grey and this component has no ground of its
           own. Naming the surface token keeps the ball visible
           when the theme colors change.

           No shadow. It carried one — on the group, so it
           followed the silhouette as it stretched — and the
           cost of taking it away is that a white ball on the
           card's own grey is about 1.06:1. The disc reads, but
           it reads as a shape rather than as an object lifted
           off anything, which is the trade. */
        fill="var(--board)"
        filterPadding={80}
      >
        <Liquid.Item
          effect="move"
          /* ── NO TRAIL. STRETCH INSTEAD. ────────────────────
             `trail` is a second body running behind the first,
             and that is what it looks like: drag slowly and
             the goo necks between them into a thin thread,
             drag fast and it gives up and you have two
             circles. Both are the effect working correctly and
             neither is what a ball being thrown around should
             do.

             `stretch` deforms the ONE body along its own
             direction of travel — it lengthens into the move
             and rounds back out when it stops. That is the
             elasticity, and there is nothing to leave behind
             because there is nothing behind it.

             A little wobble on top so the recovery is not a
             dead ease, and springiness is what decides how
             quickly the circle comes back. */
          move={{
            springiness: give / 100,
            stretch: stretch / 100,
            wobble: 0.35,
            trail: 0,
          }}
        >
          <motion.span
            className="drg-ball"
            style={{ width: size, height: size }}
            drag={drag}
            /* Numeric, not a ref: the constraint is a distance
               from where the ball already sits, and the ball
               sits in the middle of the well by construction.
               A ref would make it a measurement, and a
               measurement on a scaled card is a rect. */
            dragConstraints={{
              left: -reach.x,
              right: reach.x,
              top: -reach.y,
              bottom: reach.y,
            }}
            /* a little give at the wall, and no throw on
               release — this is a thing you place, not a thing
               you flick */
            dragElastic={0.14}
            dragMomentum={false}
            /* ── the hand, before the move ────────────────
               `whileTap` is the press and it lasts as long as
               the pointer is down, drag included — so the
               pinch is held for the whole gesture and let go
               with it, which is what a grip is. When a parent
               owns drag controls, its pointer and drag release
               call the same idempotent drop handler instead;
               the ball's shape still follows that held state.

               A spring rather than an ease: a squeeze that
               arrives on a curve is a shape being animated,
               and one that arrives with a little overshoot is
               a soft thing giving. */
            animate={externalGestures ? externalGesturePose : undefined}
            whileHover={externalGestures || reducedMotion ? undefined : { scaleX: 1 + SWELL * g, scaleY: 1 + SWELL * g }}
            whileTap={externalGestures || reducedMotion ? undefined : { scaleX: 1 - 0.16 * g, scaleY: 1 + 0.08 * g }}
            transition={reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 520, damping: 24 }}
            onHoverStart={externalGestures && !reducedMotion ? () => setHovered(true) : undefined}
            onHoverEnd={externalGestures && !reducedMotion ? () => setHovered(false) : undefined}
            /* ── SILENT WHILE IT MOVES ────────────────────
               The continuous voice belongs to a value being
               SET — a slider, a dial, a stepper — where the
               sound is telling you where you have got to. This
               is a ball in an empty box: there is no scale to
               be at a point of, so a note per frame was
               reporting nothing and chattering while it did it.

               The two ends keep theirs. Taking hold of it and
               letting go are events, and they are the only two
               this component has. */
            onPointerDown={grab}
            onDragStart={grab}
            onPointerUp={drop}
            onPointerCancel={drop}
            onDragEnd={drop}
          >
            {children}
          </motion.span>
        </Liquid.Item>
      </Liquid>
    </div>
  );
}
