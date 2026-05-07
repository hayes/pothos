interface Props {
  /** Width × height in px (the SVG draws inside this box). */
  width?: number;
  height?: number;
  /** Stem + leaf color — typically var(--bm-accent). */
  color?: string;
  /** Dark mode adjusts the vein color so it stays visible. */
  mode?: 'light' | 'dark';
  className?: string;
}

interface LeafSpec {
  x: number;
  y: number;
  r: number;
  s: number;
}

/**
 * Decorative botanical spray — a curved stem with small leaves at
 * varied angles. Pulled from directionA.jsx > BotanicalSpray. The
 * leaves are simple ellipse-shaped paths (NOT the HeartLeaf brand
 * glyph, which is reserved for the logo).
 */
export function BotanicalSpray({
  width = 320,
  height = 280,
  color = 'currentColor',
  mode = 'light',
  className,
}: Props) {
  const leaves: LeafSpec[] = [
    { x: 270, y: 30, r: -20, s: 0.7 },
    { x: 240, y: 80, r: 30, s: 0.9 },
    { x: 210, y: 130, r: -40, s: 0.8 },
    { x: 180, y: 170, r: 50, s: 1.1 },
    { x: 130, y: 210, r: -30, s: 0.85 },
    { x: 90, y: 240, r: 60, s: 0.75 },
  ];
  const veinColor = mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 320 280"
      aria-hidden="true"
      className={className}
      style={{ overflow: 'visible' }}
    >
      <path
        d="M 280 0 C 240 60, 220 120, 180 160 C 140 200, 100 220, 60 260"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.5}
      />
      {leaves.map((leaf, i) => (
        <g
          // biome-ignore lint/suspicious/noArrayIndexKey: leaves are stable position-based
          key={i}
          transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.r}) scale(${leaf.s})`}
          opacity={0.55}
        >
          <path
            d="M 0 0 C -14 -4, -22 -16, -22 -28 C -14 -32, -2 -28, 4 -20 C 10 -28, 18 -32, 22 -28 C 22 -16, 14 -4, 0 0 Z"
            fill={color}
          />
          <path d="M 0 0 L 0 -28" stroke={veinColor} strokeWidth={0.5} />
        </g>
      ))}
    </svg>
  );
}
