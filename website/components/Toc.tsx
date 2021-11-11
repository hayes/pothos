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
  active?: string;
  className?: string;
}

export function Toc({ table, active, className }: TocProps) {
  return (
    <nav className={`bg-purple-500 text-white w-64 pb-4 pl-4 overflow-scroll ${className ?? ''}`}>
      <ol>
        {table.entries.map((entry) => (
          <li key={entry.link}>
            {entry.children ? (
              <details open={entry.name === 'Guide'}>
                <summary
                  className={`block rounded-l hover:bg-purple-400 ${
                    active === entry.link ? 'font-bold text-white bg-pink-500' : ''
                  }`}
                >
                  <a className={`pl-2 py-1 select-none`} href={entry.link}>
                    {' '}
                    {entry.name}
                  </a>
                </summary>
                <ol className="block ml-2 pl-2 border-l border-pink-500 text-sm">
                  {entry.children.map((child) => (
                    <li key={child.link}>
                      <a
                        className={`block rounded-l hover:bg-purple-400 pl-2 py-1 ${
                          active === child.link ? 'font-bold text-white bg-pink-500 hover:bg-pink-500' : ''
                        }`}
                        href={child.link}
                      >
                        {child.name}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            ) : (
              <a
                className={`block pl-2 py-1 rounded-l hover:bg-purple-400 ${
                  active === entry.link ? 'rounded-l font-bold text-white bg-pink-500' : ''
                }`}
                href={entry.link}
              >
                {entry.name}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
