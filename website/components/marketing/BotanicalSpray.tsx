import { HeartLeaf } from './HeartLeaf';

interface Props {
  /** Diameter in px of the largest leaf. Smaller leaves scale relative. */
  size?: number;
  /** CSS color for fills — typically var(--bm-accent). */
  color?: string;
  className?: string;
}

interface Leaf {
  size: number;
  rotate: number;
  /** Position offsets relative to the spray container. */
  top: number;
  left: number;
  opacity: number;
}

/**
 * Decorative leaf spray for the home hero — a small cluster of HeartLeaf
 * glyphs at varied sizes/rotations/opacities. Positioned absolutely by
 * the parent; pointer-events disabled.
 */
export function BotanicalSpray({ size = 96, color = 'currentColor', className }: Props) {
  const leaves: Leaf[] = [
    { size, rotate: -10, top: 0, left: 60, opacity: 0.55 },
    { size: size * 0.7, rotate: 32, top: size * 0.3, left: 0, opacity: 0.4 },
    { size: size * 0.55, rotate: -50, top: size * 0.65, left: size * 0.4, opacity: 0.35 },
    { size: size * 0.45, rotate: 80, top: size * 0.15, left: size * 1.2, opacity: 0.3 },
  ];
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${className ?? ''}`}
      style={{ position: 'absolute', color, width: size * 2, height: size * 1.6 }}
    >
      {leaves.map((leaf, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: leaves are stable position-based
          key={i}
          style={{
            position: 'absolute',
            top: leaf.top,
            left: leaf.left,
            opacity: leaf.opacity,
          }}
        >
          <HeartLeaf size={leaf.size} fill={color} stroke="none" rotate={leaf.rotate} veins={false} />
        </span>
      ))}
    </div>
  );
}
