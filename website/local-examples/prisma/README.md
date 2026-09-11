# Publishing API with Prisma

One schema supports author pages, a private writing desk, paginated published posts, and draft
creation/editing. Prisma Utils builds the title filters and draft inputs in that same schema.

From the repository root, with Node.js 22 or newer:

```sh
pnpm install --frozen-lockfile
pnpm --dir website check:local
npm --prefix website/local-examples run prisma -- author
```

`check:local` builds the workspace packages, installs the locked local dependencies, generates the
Prisma client and Pothos types, derives SQLite DDL from `schema.prisma`, and runs the checks.
The runner creates a fresh temporary SQLite file for each invocation and deletes it after the
query finishes, including on error. It does not connect to an application database.

Choose an operation from `operations/`:

| Operation | What to observe or change |
| --- | --- |
| `author` | Maya's public profile, two published posts, and their author. Remove `bio` or `posts` and compare the SQL. |
| `aliases` | Newest and oldest posts use incompatible orderings and require a fallback query. |
| `viewer` | Maya's private email and draft. Pass `2` after the operation name to see Leo's separate draft and the other interface implementation. |
| `media` | Attachment captions belong to edges while shared images belong to nodes. The seed-library post has two attachments; use its cursor to fetch the second page. |
| `pages` | Two of three published posts, a cursor, and shared media with its uploader. Add `after` using that cursor to continue. |
| `search` | The generated title filter finds the composting post. Search for `spring` to confirm drafts stay outside the public search. |
| `create-draft` | A new unpublished post belongs to the request's author. Add a nested author field to exercise mutation selection planning. |
| `payload` | A draft inside a result object; `queryFromInfo` follows `post` to load its requested author. |

```sh
npm --prefix website/local-examples run prisma -- viewer 2
npm --prefix website/local-examples run prisma -- pages
```

After changing `schema.prisma`, regenerate the client, Pothos types and DDL with
`npm --prefix website/local-examples run generate`.

Edit the operation files and rerun the same command. The runner prints the result and emitted SQL;
SQL statement counts are different from Prisma client call counts. Each invocation starts from the
same data, so a mutation does not affect the next invocation. `check.ts` also checks changes within
one database lifetime, denied writes, node visibility, and forward/backward pagination for both
the post feed and attachment connections.

`userId` represents an already-authenticated request. The command's user argument is a test fixture,
not an authentication mechanism. Public queries filter to published posts. Only the private viewer
exposes email and drafts, and draft updates constrain both ownership and publication state.

The adapter is SQLite-specific; the Pothos definitions use the normal Prisma client and generated
types. Applications should use Prisma migrations and a driver adapter for their own database.
SQLite does not support Prisma scalar lists, so the scalar-list-filter API remains documented as
an alternative rather than being modeled as a fake SQLite field.
