import Link from 'next/link';

export function SchemaDesign() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 sm:px-10 pb-12 grid md:grid-cols-2 gap-10 md:gap-16">
      <div>
        <h2 className="font-serif font-normal text-[30px] leading-tight mt-0 mb-4">
          Design your own schema
        </h2>
        <p className="text-bm-ink-soft text-[17px] leading-relaxed mt-0 mb-5">
          Define your GraphQL schema independently of how your data is stored. Pothos checks that
          your data matches the schema and makes it easy to write resolvers where it doesn’t. Expose
          a property directly, compute a value, or load related data.
        </p>
        <p className="text-bm-ink-soft text-[17px] leading-relaxed mt-0 mb-5">
          The result is a standard GraphQL schema you can use with Yoga, Apollo Server, or any
          server that accepts a GraphQL.js schema.
        </p>
        <Link href="/docs/guide/objects" className="text-bm-accent text-[15px] hover:underline">
          Defining object types →
        </Link>
      </div>
      <div>
        <h2 className="font-serif font-normal text-[30px] leading-tight mt-0 mb-4">
          Write fewer type annotations
        </h2>
        <p className="text-bm-ink-soft text-[17px] leading-relaxed mt-0 mb-5">
          Pothos infers resolver types from your schema, so most fields need no manual type
          annotations. Arguments are typed from their definitions, parent values from the type they
          belong to, and context from your builder configuration.
        </p>
        <p className="text-bm-ink-soft text-[17px] leading-relaxed mt-0 mb-5">
          You get autocomplete inside each resolver, and TypeScript checks its return value against
          the field’s GraphQL type. These checks stay in place as your schema and data change.
        </p>
        <Link href="/docs/guide/fields" className="text-bm-accent text-[15px] hover:underline">
          Defining fields →
        </Link>
      </div>
    </section>
  );
}
