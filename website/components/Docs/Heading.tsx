import { HTMLProps } from 'react';
import LinkIcon from '@heroicons/react/outline/LinkIcon';

export function Heading({
  tag,
  id,
  children,
  className,
  ...props
}: HTMLProps<HTMLHeadingElement> & { tag: string }) {
  const Tag = tag as 'h1';

  return (
    <Tag className={`relative group items-center ${className}`} id={id} {...props}>
      {id && (
        <a
          className={`hidden group-hover:flex items-center absolute -left-8 right-full h-full ${className}`}
          href={`#${id}`}
        >
          <LinkIcon className="h-2/3" />
        </a>
      )}
      {children}
    </Tag>
  );
}
