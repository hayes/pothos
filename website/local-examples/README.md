# Local plugin examples

These examples run features that need a Node runtime or a different GraphQL executor:

- `smart-subscriptions`: initial results, event-driven updates, and independent iterator cleanup.
- `grafast`: addition plans, interface and union resolution, and missing entities.
- `federation`: entity representations, required fields, and provided fields within a subgraph.

With Node.js 22 or newer, run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir website check:local
```

The command builds the current Pothos sources, installs this directory's locked dependencies,
and checks each example's TypeScript and execution results. Grafast 1.0 requires GraphQL 16;
the website uses the repository's GraphQL 17 override. This separate npm installation keeps
both environments intact. `npm ci --install-links` copies the built workspace packages so their
imports resolve against the local GraphQL 16 installation instead of following workspace symlinks.
No database, HTTP server, federation router, or external tracing service starts during these checks.

After the first setup, edit the schema, operations, or assertions and rerun:

```sh
npm --prefix website/local-examples test
```

Rerun `check:local` after changing a Pothos package so the local installation uses its newly built
code. The Documentation playground workflow runs the same checks on pull requests.
