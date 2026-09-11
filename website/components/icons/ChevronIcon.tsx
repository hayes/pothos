interface ChevronIconProps {
  size?: number;
  className?: string;
  open: boolean;
}

export function ChevronIcon({ size = 12, className, open }: ChevronIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 120ms ease',
      }}
    >
      <polyline points="4 2.5 8 6 4 9.5" />
    </svg>
  );
}
