interface Props {
  size?: number;
  /** Tailwind text color class (e.g. "text-bm-ink-muted"). */
  colorClass?: string;
}

export function Spinner({ size = 12, colorClass = 'text-current' }: Props) {
  return (
    <span
      className={`animate-bm-spin inline-block rounded-full border-[1.5px] border-t-transparent ${colorClass}`}
      style={{
        width: size,
        height: size,
        borderColor: 'currentColor',
        borderTopColor: 'transparent',
      }}
    />
  );
}
