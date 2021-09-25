import { MouseEvent, useEffect, useRef, useState } from 'react';

export const dynamicStyles = <div className="pl-2 pl-6 pl-8" />;

export function TocEntry({ active, url, depth, text }: { url: string; depth: number; text: any, active: boolean }) {
  const [target, setTarget] = useState<HTMLElement>(null);
  const id = url.startsWith('#') ? url.slice(1) : null;

  useEffect(() => {
    setTarget(id ? document.getElementById(id) : null);
  }, [id]);

  function handleClick(ev: MouseEvent) {
    if (target) {
      ev.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <li
      className={`my-1 py-1 pl-${(depth - 2) * 4 + 2} ${
        active ? 'border-l-4 border-pink-500 font-bold' : 'border-l-4 border-transparent'
      }`}
    >
      <a href={url} onClick={handleClick}>
        {text}
      </a>
    </li>
  );
}

export function Toc({
  items,
  className,
}: {
  className: string;
  items: {
    url: string;
    depth: number;
    text: any;
  }[];
}) {
  const ref = useRef<HTMLElement>();
  const positions = useRef<{ id: string; offset: number }[]>([]);
  const [activeId, setActiveId] = useState<null | string>(null);

  useEffect(() => {
    const observer = new MutationObserver(updatePositions);
    observer.observe(ref.current, {
      childList: true,
      subtree: true,
    });

    document.addEventListener('scroll', setClosestHeader, true);

    updatePositions();

    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', setClosestHeader, true);
    };
  }, [ref]);

  function updatePositions() {
    positions.current = [];
    items.map((item) => {
      const id = item.url.startsWith('#') ? item.url.slice(1) : null;

      if (id) {
        positions.current.push({ id, offset: document.getElementById(id).offsetTop });
      }
    });

    setClosestHeader();
  }

  function setClosestHeader() {
    const parent = ref.current.parentElement as HTMLElement;
    const offset = parent.offsetTop;
    const rect = parent.getClientRects()[0];

    let closest = positions.current[0].id;

    for (const next of positions.current) {
      if (next.offset - offset + rect.y <= 64) {
        closest = next.id;
      } else {
        break;
      }
    }

    setActiveId(closest);
  }

  return (
    <nav ref={ref} className={`flex items-start px-2 ${className} text-sm`}>
      <ol className="border-l border-gray-200 flex-shrink">
        {items.map((item, i) => (
          <TocEntry active={item.url.slice(1) === activeId } key={item.url} {...item} />
        ))}
      </ol>
    </nav>
  );
}
