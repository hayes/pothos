import 'tailwindcss/tailwind.css';

function MyApp({ Component, pageProps }) {
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
      `}</style>
      <div className="h-full overflow-scroll">
          <header className="z-10 fixed top-0 flex w-full h-16 py-2 px-4 shadow justify-between bg-purple-700 text-white">
            <img className="h-full" src="/assets/logo-name-dark.svg"></img>
            <ul className="flex space-x-3 h-full flex-row items-center">
              <li>Home</li>
              <li className="underline">Docs</li>
              <li>Examples</li>
              <li>Github</li>
            </ul>
          </header>
          <section className="mb-16 p-8 max-w-[800px] m-auto shadow min-h-[500px]">
            <Component {...pageProps} />
          </section>
        </div>
    </>
  );
}

export default MyApp;
