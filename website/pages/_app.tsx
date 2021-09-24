import 'tailwindcss/tailwind.css';

function MyApp({ Component, pageProps, meta, ...props}) {
  return (
    <>
      <header className="z-10 fixed top-0 flex w-full h-16 py-2 px-4 shadow justify-between bg-purple-700 text-white">
        <img className="h-full" src="/assets/logo-name-dark.svg"></img>
        <ul className="flex space-x-3 h-full flex-row items-center">
          <li>Home</li>
          <li className="underline">Docs</li>
          <li>Examples</li>
          <li>Github</li>
        </ul>
      </header>
      <section className="mt-16 pt-8 h-full w-[800px] m-auto shadow min-h-[1500px]">
        <Component {...pageProps} />
      </section>
    </>
  );
}

export default MyApp;
