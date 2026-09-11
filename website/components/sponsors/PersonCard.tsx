interface Props {
  login: string;
  /** Display name when available; falls back to `@login` rendering. */
  name?: string;
  avatarUrl: string;
  htmlUrl: string;
  /** Optional small detail line (e.g. contribution count, sponsor tier). */
  detail?: string;
  size?: number;
}

/**
 * Avatar + name + optional detail line. Used by both the sponsors wall
 * and the contributors wall so they read as one consistent card type.
 * The whole card is a single link to the person's GitHub profile.
 */
export function PersonCard({ login, name, avatarUrl, htmlUrl, detail, size = 56 }: Props) {
  const display = name?.trim() ? name : login;
  const subtitle = name ? `@${login}` : detail;
  const showDetailLine = name && detail; // both -> two lines

  return (
    <a
      href={htmlUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col items-center text-center w-[88px] gap-2 hover:opacity-90 transition-opacity"
      title={`${display} (@${login})`}
    >
      <span
        className="block rounded-full overflow-hidden border border-bm-line group-hover:border-bm-accent transition-colors"
        style={{ width: size, height: size }}
      >
        {/* biome-ignore lint/performance/noImgElement: GitHub avatars
            are CDN URLs already cache-friendly */}
        <img
          src={avatarUrl}
          alt={login}
          width={size}
          height={size}
          loading="lazy"
          className="block size-full object-cover"
        />
      </span>
      <span className="block text-[12px] text-bm-ink truncate max-w-full">{display}</span>
      {subtitle && (
        <span className="block text-[10px] text-bm-ink-muted truncate max-w-full font-mono">
          {subtitle}
        </span>
      )}
      {showDetailLine && (
        <span className="block text-[10px] text-bm-ink-muted truncate max-w-full">{detail}</span>
      )}
    </a>
  );
}
