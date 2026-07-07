import { LEAF_ANCHOR, LEAF_MIDRIB, LEAF_PATH } from './HeartLeaf';

interface Props {
  /** Width × height in px (the SVG draws inside this box). */
  width?: number;
  height?: number;
  /** Stem + leaf color — typically var(--bm-accent). */
  color?: string;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

/** One cubic-Bezier stem segment: [start, control1, control2, end]. */
type Cubic = [Point, Point, Point, Point];

interface LeafSpec {
  /** Position along the whole stem, 0 (top) to 1 (growing tip). */
  t: number;
  /** Leaf scale — the leaf art is 55 units tall at scale 1. */
  s: number;
  /** Which side of the stem the leaf hangs from. */
  side: 1 | -1;
}

interface VineSpec {
  segs: Cubic[];
  leaves: LeafSpec[];
}

const pt = (x: number, y: number): Point => ({ x, y });

// Three pothos vines trailing from the top edge, staggered lengths and
// gentle opposing sways so they read as one plant spilling over a shelf.
const VINES: VineSpec[] = [
  {
    // right — the longest runner
    segs: [
      [pt(266, -10), pt(274, 35), pt(252, 70), pt(256, 115)],
      [pt(256, 115), pt(259, 160), pt(242, 205), pt(250, 252)],
    ],
    leaves: [
      { t: 0.08, s: 0.52, side: 1 },
      { t: 0.22, s: 0.62, side: -1 },
      { t: 0.38, s: 0.72, side: 1 },
      { t: 0.54, s: 0.6, side: -1 },
      { t: 0.7, s: 0.68, side: 1 },
      { t: 0.85, s: 0.5, side: -1 },
      { t: 0.97, s: 0.38, side: 1 },
    ],
  },
  {
    // middle
    segs: [
      [pt(184, -10), pt(178, 30), pt(194, 60), pt(188, 95)],
      [pt(188, 95), pt(184, 125), pt(172, 155), pt(178, 186)],
    ],
    leaves: [
      { t: 0.1, s: 0.52, side: -1 },
      { t: 0.3, s: 0.6, side: 1 },
      { t: 0.5, s: 0.56, side: -1 },
      { t: 0.72, s: 0.58, side: 1 },
      { t: 0.92, s: 0.4, side: -1 },
    ],
  },
  {
    // left — the youngest, shortest vine
    segs: [[pt(112, -10), pt(119, 28), pt(102, 60), pt(111, 105)]],
    leaves: [
      { t: 0.15, s: 0.5, side: 1 },
      { t: 0.45, s: 0.62, side: -1 },
      { t: 0.75, s: 0.55, side: 1 },
      { t: 0.96, s: 0.36, side: -1 },
    ],
  },
];

function cubicAt(p: Cubic, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
}

function cubicTangent(p: Cubic, t: number): Point {
  const u = 1 - t;
  const dx =
    3 * u * u * (p[1].x - p[0].x) + 6 * u * t * (p[2].x - p[1].x) + 3 * t * t * (p[3].x - p[2].x);
  const dy =
    3 * u * u * (p[1].y - p[0].y) + 6 * u * t * (p[2].y - p[1].y) + 3 * t * t * (p[3].y - p[2].y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Point + unit tangent at a global `t` spanning all of a stem's segments. */
function stemAt(segs: Cubic[], tGlobal: number): { p: Point; tan: Point } {
  const n = segs.length;
  const i = Math.min(Math.floor(tGlobal * n), n - 1);
  const t = tGlobal * n - i;
  return { p: cubicAt(segs[i], t), tan: cubicTangent(segs[i], t) };
}

function stemPathD(segs: Cubic[]): string {
  let d = `M ${segs[0][0].x} ${segs[0][0].y}`;
  for (const s of segs) {
    d += ` C ${s[1].x} ${s[1].y}, ${s[2].x} ${s[2].y}, ${s[3].x} ${s[3].y}`;
  }
  return d;
}

/**
 * Decorative pothos plant — trailing vines that hang from the top edge of
 * the hero, each carrying alternating heart-shaped leaves on short curved
 * petioles. The leaves are the shared LEAF_PATH from HeartLeaf, drawn
 * tip-down (as trailing pothos foliage hangs) and pinned to the stem at
 * the petiole notch (LEAF_ANCHOR). Color follows `currentColor` and the
 * midribs use the theme-aware `--bm-veins` token, so the art adapts to
 * light and dark themes automatically.
 */
export function BotanicalSpray({
  width = 320,
  height = 300,
  color = 'currentColor',
  className,
}: Props) {
  const veinColor = 'var(--bm-veins)';

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 320 300"
      aria-hidden="true"
      className={className}
    >
      {VINES.map((vine) => (
        <g key={stemPathD(vine.segs)}>
          <path
            d={stemPathD(vine.segs)}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            opacity={0.55}
            strokeLinecap="round"
          />
          {vine.leaves.map((leaf) => {
            const { p, tan } = stemAt(vine.segs, leaf.t);
            const normal = { x: -tan.y, y: tan.x };
            const k = leaf.s;
            // Petiole: a short arc from the stem out to the side and
            // slightly down, ending where the leaf's notch attaches.
            const po = 8 * k + 4;
            const pd = 7 * k + 2;
            const lx = p.x + leaf.side * normal.x * po + tan.x * pd;
            const ly = p.y + leaf.side * normal.y * po + tan.y * pd;
            const cx = p.x + leaf.side * normal.x * po * 0.3 + tan.x * pd * 0.7;
            const cy = p.y + leaf.side * normal.y * po * 0.3 + tan.y * pd * 0.7;
            // Smaller (younger) leaves splay further from vertical.
            const rot = leaf.side * (13 + 17 * (1 - k));
            const opacity = 0.45 + 0.3 * k;
            return (
              <g key={`${leaf.t}`} opacity={opacity.toFixed(2)}>
                <path
                  d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${lx.toFixed(1)} ${ly.toFixed(1)}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.2}
                />
                <g
                  transform={`translate(${lx.toFixed(1)}, ${ly.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${k}) translate(${-LEAF_ANCHOR.x}, ${-LEAF_ANCHOR.y})`}
                >
                  <path d={LEAF_PATH} fill={color} />
                  <path
                    d={LEAF_MIDRIB}
                    stroke={veinColor}
                    strokeWidth={(0.55 / k).toFixed(2)}
                    fill="none"
                    strokeLinecap="round"
                  />
                </g>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
