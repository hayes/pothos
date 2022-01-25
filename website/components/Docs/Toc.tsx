/* eslint-disable unicorn/prefer-query-selector */
/* eslint-disable no-magic-numbers */
import { MouseEvent, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TableOfContents } from '../Toc';
import GithubLogo from './github';
import { useCurrentDocsPage } from './Nav';

export const dynamicStyles = <div className="pl-2 pl-6 pl-8" />;

export function TocEntry({
  active,
  url,
  depth,
  text,
}: {
  url: string;
  depth: number;
  text: string;
  active: boolean;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
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
      className={`hover:bg-green my-1 ${
        active ? 'border-l-2 border-darkGreen font-bold' : 'border-l-4 border-transparent'
      }`}
    >
      <a href={url} onClick={handleClick} className={`block py-1 pl-${(depth - 2) * 4 + 2}`}>
        {text}
      </a>
    </li>
  );
}

export function Toc({
  items,
  className,
  nav,
}: {
  className: string;
  items: {
    url: string;
    depth: number;
    text: string;
  }[];
  nav: TableOfContents;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const positions = useRef<{ id: string; offset: number }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  function setClosestHeader() {
    const parent = ref.current!.parentElement!;
    const offset = parent.offsetTop ?? 0;
    const rect = parent.getClientRects()[0];

    if (positions.current.length === 0) {
      return;
    }

    let closest = positions.current[0].id;

    for (const next of positions.current) {
      if (next.offset - offset + rect.y <= 50) {
        closest = next.id;
      } else {
        break;
      }
    }

    setActiveId(closest);
  }

  function updatePositions() {
    positions.current = [];
    items.forEach((item) => {
      const id = item.url.startsWith('#') ? item.url.slice(1) : null;
      const el = id && document.getElementById(id);

      if (el) {
        positions.current.push({ id, offset: el.offsetTop });
      }
    });

    setClosestHeader();
  }

  useEffect(() => {
    const observer = new MutationObserver(updatePositions);
    observer.observe(ref.current!, {
      childList: true,
      subtree: true,
    });

    document.addEventListener('scroll', setClosestHeader, true);
    window.addEventListener('resize', updatePositions);

    updatePositions();

    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', setClosestHeader, true);
      window.removeEventListener('resize', updatePositions);
    };
  }, [ref, items]);

  const currentPage = useCurrentDocsPage(nav);

  return (
    <nav ref={ref} className={`flex items-start pl-4 pr-2 ${className} text-sm`}>
      <Head>
        <title>{currentPage?.name ?? 'Pothos Docs'}</title>
      </Head>
      {currentPage && (
        <Link href={currentPage.githubFile}>
          <a className="flex space-x-2 mb-8 dark:text-white">
            <GithubLogo height={20} width={20} />

            <span>Edit on Github</span>
          </a>
        </Link>
      )}
      <ol className="border-l border-darkGreen flex-shrink max-w-sm pr-2">
        {items.map((item, i) => (
          <TocEntry active={item.url.slice(1) === activeId} key={item.url} {...item} />
        ))}
      </ol>
    </nav>
  );
}
