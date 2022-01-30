import { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MenuIcon from '@heroicons/react/outline/MenuIcon';
import GithubLogo from './Docs/github';
import { SearchPane } from './Search';
import { TableOfContents, Toc } from './Toc';

export function Layout({ children, toc }: { children: ReactNode; toc: TableOfContents }) {
  const router = useRouter();
  return (
    <>
      <style global jsx>{`
        html,
        body,
        body > div:first-child,
        div#__next,
        div#__next > div {
          height: 100%;
        }
        div#__next {
          padding-top: 4rem;
        }
        details > summary {
          list-style: none;
        }
        details > summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
      <div className="h-full overflow-y-auto dark:bg-[#22212C]">
        <Head>
          <link
            rel="stylesheet"
            href="//cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.4.0/build/styles/atom-one-dark.min.css"
          ></link>
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="canonical" href={`https://pothos-graphql.dev${router.pathname}`} />
          <meta httpEquiv="content-language" content="en-us" />
          `<meta name="theme-color" content="#5E854C" />
        </Head>
        <header className="px-16 xl:pl-4 z-10 fixed top-0 bottom-0 flex w-full h-16 py-2 shadow justify-between bg-green text-white">
          <Link href="/">
            <a>
              <img
                alt="Pothos GraphQL"
                className="hidden sm:block h-full"
                src="/assets/logo-name-dark.svg"
              ></img>
              <img
                alt="Pothos GraphQL"
                className="sm:hidden h-full"
                src="/assets/logo-dark.svg"
              ></img>
            </a>
          </Link>
          <ul className="flex space-x-3 h-full flex-row items-center lg:space-x-4">
            <li>
              <a className="flex space-x-2 hover:underline" href="https://github.com/hayes/pothos">
                <GithubLogo height={24} width={24} />
                <span>Github</span>
              </a>
            </li>
            <li className="hidden sm:block">
              <a href="https://github.com/hayes/pothos/tree/main/examples">Examples</a>
            </li>
          </ul>
        </header>
        <details className="xl:hidden absolute top-0 z-20 h-full">
          <summary className="p-4 text-white">
            <MenuIcon className="h-8" />
          </summary>
          <Toc
            active={router.pathname}
            className="absolute py-4 xl:hidden top-16 bottom-0"
            table={toc}
          />
        </details>
        <SearchPane />
        <Toc
          className="hidden xl:block absolute py-4 top-16 bottom-0"
          table={toc}
          active={router.pathname}
        />
        <div className="flex items-center">
          <section className="relative mb-16 p-8 w-full md:w-[min(75%,800px)] xl:m-auto shadow min-h-[500px] dark:bg-[#22212C] dark:text-white">
            {children}
          </section>
        </div>
        <footer className="flex justify-center m-12">
          <div className="text-align-center text-coolGray-400 text-xs">
            {`© ${new Date().getFullYear()} Michael Hayes`}
          </div>
        </footer>
      </div>
    </>
  );
}
