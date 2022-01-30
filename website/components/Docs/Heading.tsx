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
    <a href={`#${id}`}>
      <Tag className={`relative group items-center ${className}`} id={id} {...props}>
        {id && (
          <div
            className={`hidden group-hover:flex items-center absolute -left-6 right-full h-full ${className}`}
          >
            <LinkIcon className="h-2/3" />
          </div>
        )}
        {children}
      </Tag>
    </a>
  );
}
