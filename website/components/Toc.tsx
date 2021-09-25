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
    <nav
      className={` bg-purple-400 text-white w-64 pb-4 pl-4 overflow-scroll ${
        className ?? ''
      }`}
    >
      <ol>
        {table.entries.map((entry) => (
          <li key={entry.link}>
            <a
              className={`block pl-2 py-1 ${
                active === entry.link ? 'rounded-l font-bold text-white bg-purple-600' : ''
              }`}
              href={entry.link}
            >
              {entry.name}
            </a>
            {entry.children && (
              <ol className="block ml-2 pl-2 border-l-2 border-purple-500 text-sm">
                {entry.children.map((child) => (
                  <li key={child.link}>
                    <a
                      className={`block pl-2 py-1 ${
                        active === child.link ? 'rounded-l font-bold text-white bg-purple-600' : ''
                      }`}
                      href={child.link}
                    >
                      {child.name}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
