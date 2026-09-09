interface Props {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  size?: number;
  /** Optional contribution count or sponsor tier for the tooltip. */
  detail?: string;
}

export function SponsorAvatar({ login, avatarUrl, htmlUrl, size = 56, detail }: Props) {
  const title = detail ? `${login} — ${detail}` : login;
  return (
    <a
      href={htmlUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-full overflow-hidden border border-bm-line hover:border-bm-accent transition-colors"
      title={title}
      aria-label={title}
    >
      {/* biome-ignore lint/performance/noImgElement: GitHub avatars are
          already cache-friendly CDN URLs */}
      <img
        src={avatarUrl}
        alt={login}
        width={size}
        height={size}
        loading="lazy"
        className="block size-full object-cover"
        style={{ width: size, height: size }}
      />
    </a>
  );
}
