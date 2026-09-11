# Documentation checks

After installing the workspace dependencies, run these commands from the repository root.

```sh
pnpm --dir website check:examples
```

This extracts the current Overview schema, the Guide schema/query/response, and the Printing Schemas
example directly from MDX. It checks their types against the current core source, executes the
queries, checks optional argument behavior and the computed field, and reads the generated SDL back
as a schema. Temporary files are removed when the command finishes.

The check uses the workspace compiler and source aliases. It does not validate the Guide's npm
installation, NodeNext configuration, Yoga server, or every documentation snippet. Changes to those
parts still need a fresh installation and HTTP check. `doc-example-assertions.mjs` runs inside the
temporary fixture created by `check-doc-examples.mjs`.

To check links and anchors, build and start the website:

```sh
pnpm --dir website exec fumadocs-mdx
pnpm --dir website exec next build --webpack
pnpm --dir website start
```

Then, in another terminal:

```sh
pnpm --dir website check:links
# Or pass the origin of a server on another port:
pnpm --dir website check:links http://localhost:4317
```

This loads every documentation route from the local server and checks links to documentation pages
and their rendered anchors. Links to `https://pothos-graphql.dev/docs/...` are checked against the
same local pages. External websites, assets, and Markdown export routes are outside this check.
