interface CollapseIconProps {
  size?: number;
  className?: string;
  collapsed: boolean;
}

export function CollapseIcon({ size = 14, className, collapsed }: CollapseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{
        transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 120ms',
      }}
    >
      <polyline points="9 3 5 7 9 11" />
    </svg>
  );
}
