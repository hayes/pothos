import { ChangeEvent, useMemo, useRef, useState } from 'react';
import debounce from 'just-debounce';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useClickOutside } from '../util/useClickOutside';

const searchQuery = /* graphql */ `
  query($query: String!) {
    search(query: $query) {
    doc {
        title
        link
        description
      }
      matches {
        kind
        section {
          link
          heading
          md
        }
      }
    }
  }
`;

interface SearchResult {
  doc: {
    title: string;
    link: string;
    description: string;
  };
  matches: {
    kind: 'Content' | 'Description' | 'Heading' | 'Title';
    section?: {
      link: string;
      heading: string;
      md: string;
    };
  }[];
}
async function fetchSearchResults(query: string) {
  if (!query) {
    return [];
  }

  const res = await fetch('/api/graphql', {
    method: 'Post',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: searchQuery,
      variables: {
        query,
      },
    }),
  });

  const result = (await res.json()) as { data?: { search: [] }; errors?: { message: string }[] };

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return result.data!.search as SearchResult[];
}

export function SearchPane() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);

  useClickOutside(detailsRef, () => {
    if (open) {
      summaryRef.current?.focus();
      setOpen(false);
    }
  });

  const onChange = useMemo(
    () =>
      debounce((ev: ChangeEvent<HTMLInputElement>) => {
        setQuery(ev.target.value);
        // eslint-disable-next-line no-magic-numbers
      }, 300),
    [],
  );

  const { data, isLoading, error } = useQuery(['docsSearch', query], () =>
    fetchSearchResults(query),
  );

  return (
    <details
      ref={detailsRef}
      className="absolute top-0 z-10 h-full right-4"
      open={open}
      onToggle={(ev) => {
        const shouldOpen = (ev.currentTarget as HTMLDetailsElement).open;
        setOpen(shouldOpen);

        if (shouldOpen) {
          searchRef.current?.focus();
        }
      }}
    >
      <summary ref={summaryRef} className="p-4 -mr-2 cursor-pointer text-white">
        <MagnifyingGlassIcon className="h-6 w-6" />
      </summary>
      <div
        className={`absolute py-4 top-16 bottom-0 -right-4 dark:bg-[#282a36] shadow w-96 pb-4 px overflow-y-auto z-20 bg-white`}
      >
        <label htmlFor="search-field" className="sr-only">
          Search
        </label>
        <div className="relative w-full text-gray-400 focus-within:text-gray-600 dark:focus-within:text-gray-100">
          <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="border-b border-gray-300 dark:border-gray-600 focus-within:border-green">
            <input
              ref={searchRef}
              id="search-field"
              className="block w-full h-full pl-10 pr-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-600 border-0 border-b border-transparent focus:ring-0 light:rounded dark:bg-transparent"
              placeholder="Search"
              type="search"
              name="search"
              onChange={onChange}
            />
          </div>
        </div>
        <div className="dark:text-gray-100">
          {/* eslint-disable-next-line no-nested-ternary */}
          {isLoading ? (
            <div className="p-4">Searching...</div>
          ) : error ? (
            <pre>{(error as Error).message}</pre>
          ) : (
            <ul className="mt-1">
              {data!.map((result) => (
                <li className="p-2 border-b border-gray-500 hover:border-green hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Link href={result.doc.link} className="block">
                    <h2 className="text-lg font-semibold">{result.doc.title}</h2>
                    <p className="text-sm px-2 text-gray-600 dark:text-gray-400">
                      - {result.doc.description}
                    </p>
                  </Link>
                  <ul className="py-2">
                    {result.matches
                      .filter((match) => match.kind === 'Heading' || match.kind === 'Content')
                      .map((match) => (
                        <li className="px-2">
                          <Link href={match.section!.link}>
                            <h3 className="text-md hover:underline"># {match.section?.heading}</h3>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
