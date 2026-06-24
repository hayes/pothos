interface Props {
  width?: number;
  height?: number;
  className?: string;
  /** Tailwind color class — defaults to ink so the wordmark adopts the
   *  current theme's foreground automatically. */
  colorClassName?: string;
  /** Omit the inner `role="img"` + `aria-label` — set this when an
   *  outer wrapper already provides the accessible label (avoids the
   *  duplicate landmark warning). */
  suppressLabel?: boolean;
}

/**
 * Pothos wordmark — renders the monochrome SVG silhouette via CSS
 * `mask-image` and fills it with the current theme's ink color. No
 * separate light/dark assets required and no JS theme listener — the
 * BM `--bm-ink` token does the work, so the logo flips with the rest
 * of the chrome on every theme toggle.
 */
export function Wordmark({
  width = 130,
  height = 32,
  className = '',
  colorClassName = 'bg-bm-ink',
  suppressLabel = false,
}: Props) {
  const maskUrl = 'url(/assets/logo-name-mono.svg)';
  const a11y = suppressLabel
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': 'Pothos' } as const);
  return (
    <span
      {...a11y}
      className={`block ${colorClassName} ${className}`}
      style={{
        width,
        height,
        maskImage: maskUrl,
        WebkitMaskImage: maskUrl,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'left center',
        WebkitMaskPosition: 'left center',
      }}
    />
  );
}
