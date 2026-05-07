interface Props {
  size?: number;
  fill?: string;
  stroke?: string;
  veins?: boolean;
  rotate?: number;
  className?: string;
}

/**
 * The brand glyph — a stylized heart-shaped leaf used as the logo and
 * as decorative spray. Pulled from the design handoff's shared.jsx.
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
      <path
        d="M32 58 C 32 44, 6 40, 6 18 C 6 10, 12 6, 18 6 C 24 6, 30 10, 32 18 C 34 10, 40 6, 46 6 C 52 6, 58 10, 58 18 C 58 40, 32 44, 32 58 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke === 'none' ? 0 : 1.5}
      />
      {veins && (
        <g stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" fill="none" strokeLinecap="round">
          <path d="M32 56 L 32 18" />
          <path d="M32 38 C 24 36, 18 30, 14 22" />
          <path d="M32 38 C 40 36, 46 30, 50 22" />
          <path d="M32 28 C 26 26, 22 22, 20 16" />
          <path d="M32 28 C 38 26, 42 22, 44 16" />
        </g>
      )}
    </svg>
  );
}
