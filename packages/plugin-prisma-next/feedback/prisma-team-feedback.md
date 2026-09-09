Stuff I hit building the Pothos plugin. Long-form with file refs is in prisma-next-painpoints.md.

Missing features:

- Many-to-many isn't implemented end-to-end. Not clear what the runtime API will look like or how it fits into the plugin. Today the plugin rejects M:N at schema build and routes users to explicit junction models. This is the most-asked-about gap for anyone coming from plugin-prisma.

Typing stuff that needed workarounds:

- No filter-only refinement view on Collection. Need a callback type that doesn't widen back to the full chain after .where(...). Today the plugin gates this with type-level Omit, but it's brittle — anything that exposes a raw refine callback eventually breaks.

- No way to reverse an OrderByItem. Backward cursor pagination needs to flip orderBy direction; there's no API to invert opaque OrderByItems. The plugin has to own orderBy emission entirely, which means t.relatedConnection is where-only — a user-supplied orderBy can't be safely reversed.

- where / take / orderBy / skip are chain methods, not separate options. Means user-facing options end up as one big callback returning a refined Collection. Would prefer discrete option fields so the plugin can decide per-field-shape which ones a user can set.

- combine returns results as a nested map under the relation key. For aliased GraphQL fields the plugin has to synthesize prefixed keys going in and walk-and-lift them going out on every resolve. An "aliased include with distinct refinements" API would skip the mapping dance.

- IsToOneRelationNullable exists internally but isn't exported. Ported a minimal version for relation nullability defaults.

- SQL and Mongo Collection shapes diverge enough that a Pothos plugin can't target both. Plugin is SQL-only by construction. Low-priority flag.

Internal query optimizations I don't care about as much:

- Depth-2+ includes fall back to multi-query. { users { posts { author } } } emits 3 SQL statements on SQLite. Correctness is fine via the multi-query stitch, just extra round-trips.

- combine + count fall back to multi-query. Hits every count field and any connection with totalCount: true. Same story — correctness fine, just extra round-trips. Test capture counts are >= 1 instead of === 1 for both.
