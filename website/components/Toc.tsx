import Link from "next/link";

export interface TableOfContentsEntry {
  name: string;
  link: string;
  children?: TableOfContentsEntry[];
}

export interface TableOfContents {
  entries: TableOfContentsEntry[];
}

export interface TocProps {
  table: TableOfContents;
  active: string
  className?: string;
}

export function Toc({ table, active, className }: TocProps) {
  return (
    <nav className={`bg-gray-300 shadow dark:bg-darkGreen dark:text-white w-64 pb-4 pl-4 overflow-scroll z-10 ${className ?? ''}`}>
      <ol>
        {table.entries.map((entry) => (
          <li key={entry.link}>
            {entry.children ? (
              <details open={entry.name === 'Guide'}>
                <summary
                  className={`block rounded-l hover:bg-green hover:text-white ${
                    active === entry.link ? 'font-bold dark:text-white ' : ''
                  }`}
                >
                  <Link href={entry.link}>
                    <a className={`pl-2 py-1 select-none block`}>
                      {entry.name}
                    </a>
                  </Link>
                </summary>
                <ol className="block ml-2 pl-2 border-l border-darkGreen dark:border-white text-sm">
                  {entry.children.map((child) => (
                    <li key={child.link}>
                      <Link href={child.link}>
                        <a
                          className={`block rounded-l hover:bg-green hover:text-white pl-2 py-1 ${
                            active === child.link
                              ? 'font-bold dark:text-white'
                              : ''
                          }`}
                        >
                          {child.name}
                        </a>
                      </Link>
                    </li>
                  ))}
                </ol>
              </details>
            ) : (
              <Link href={entry.link}>
                <a
                  className={`block pl-2 py-1 rounded-l hover:bg-green hover:text-white ${
                    active === entry.link ? 'rounded-l font-bold dark:text-white ' : ''
                  }`}
                >
                  {entry.name}
                </a>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
