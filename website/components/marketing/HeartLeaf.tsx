interface Props {
  size?: number;
  fill?: string;
  stroke?: string;
  veins?: boolean;
  rotate?: number;
  className?: string;
}

/**
 * Pothos leaf outline (Epipremnum aureum): an ovate-cordate blade with a
 * shallow sinus dimple where the petiole attaches, rounded basal lobes,
 * and a long acuminate drip-tip that sways slightly off-axis. Drawn in a
 * 64x64 box with the petiole notch at the top and the tip at the bottom.
 *
 * Shared by the brand glyph below and by BotanicalSpray, so the hero art
 * and the logo mark stay one drawing.
 */
export const LEAF_PATH =
  'M 37 60 C 34.1 54.7, 30.7 49.2, 26.5 45 C 19.1 37.6, 11.5 30.5, 11 20 C 10.7 14, 15.6 6.5, 21.5 5.6 C 24.7 5.1, 28.1 6.4, 31 7.8 C 34.1 6.8, 37.3 4.2, 40.5 4.8 C 47.1 6, 53.8 12.3, 53.5 19 C 53 29, 47 35.1, 42.5 44 C 40 49, 36.9 54.4, 37 60 Z';

/** Midrib — petiole notch down to the drip-tip, drifting with the tip. */
export const LEAF_MIDRIB = 'M 31.3 9.5 C 32 24, 34.5 43, 36.6 57.5';

/** Arcuate secondary veins (two pairs; drawn only when `veins` is set). */
export const LEAF_VEINS = [
  'M 31.8 16 C 26 17.5, 19.5 21.5, 15.5 28',
  'M 32.4 16 C 38.5 17, 45 20.5, 49 27.5',
  'M 33 29 C 29.5 31, 26.5 34, 24.5 38',
  'M 33.6 29 C 38 30.5, 41.5 33.5, 43.5 38',
];

/** Sinus point (petiole attachment) — the anchor other art rotates around. */
export const LEAF_ANCHOR = { x: 31, y: 7.8 };

/**
 * The brand glyph — the pothos leaf used as the logo mark and as
 * decorative art. Fills with `currentColor` by default so it adapts to
 * both themes; veins use the theme-aware `--bm-veins` token.
 */
export function HeartLeaf({
  size = 32,
  fill = 'currentColor',
  stroke = 'none',
  veins = true,
  rotate = 0,
  className,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${rotate}deg)` }}
      className={className}
      aria-hidden="true"
    >
      <path d={LEAF_PATH} fill={fill} stroke={stroke} strokeWidth={stroke === 'none' ? 0 : 1.5} />
      {veins && (
        <g stroke="var(--bm-veins)" strokeWidth="0.9" fill="none" strokeLinecap="round">
          <path d={LEAF_MIDRIB} strokeWidth="1.1" />
          {LEAF_VEINS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}
