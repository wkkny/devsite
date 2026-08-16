# AsciiText

`AsciiText` renders text as either FIGlet ASCII art or custom pixel-grid lettering.

## Usage

```tsx
import { AsciiText } from '@/components/ascii-text'

<AsciiText text="KB" variant="pixel" size="md" />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | Required | Text to render. |
| `variant` | `'ansi' \| 'ansi-shadow' \| 'pixel'` | `'ansi-shadow'` | Rendering style. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Render size. |
| `color` | `string` | `undefined` | CSS color value for the text/pixels. |
| `backgroundColor` | `string` | `undefined` | CSS background color. |
| `className` | `string` | `undefined` | Extra classes for the root element. |
| `style` | `CSSProperties` | `undefined` | Inline styles for the root element. |

## Variants

### `ansi`

Uses FIGlet's `ANSI Regular` font.

```tsx
<AsciiText text="KB" variant="ansi" />
```

### `ansi-shadow`

Uses FIGlet's `ANSI Shadow` font.

```tsx
<AsciiText text="KB" variant="ansi-shadow" />
```

### `pixel`

Uses a custom pixel-font grid. Each letter is defined as rows of `1`s and `0`s in `PIXEL_FONT`.

```tsx
<AsciiText text="KB" variant="pixel" />
```

Connected pixels are optimized into bars/rectangles instead of rendering every pixel as an individual square.

## Adding or editing pixel letters

Pixel letters are defined in `PIXEL_FONT` inside `ascii-text.tsx`.

Example:

```ts
K: ['1001', '1010', '1100', '1010', '1001']
```

- `1` means filled pixel
- `0` means empty pixel
- each string is one row
- rows can have different widths, but consistent width is preferred

## Notes

- `ansi` and `ansi-shadow` rely on `figlet`.
- `pixel` does not use FIGlet.
- Pixel glyphs are cached after generation.
- Unknown pixel characters render as spaces.
