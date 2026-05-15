// Type declarations for the hand-written sql.js-backed sqlite driver.
// Mirrors the surface of upstream `@prisma-next/driver-sqlite/runtime`
// so user code (and the prisma-next plugin's types) see a compatible
// shape regardless of whether they import the upstream or the shim.
import type { RuntimeDriverDescriptor } from '@prisma-next/framework-components/execution';

export type SqliteBinding = { readonly kind: 'path'; readonly path: string };

declare const sqliteRuntimeDriverDescriptor: RuntimeDriverDescriptor<'sql', 'sqlite', void, unknown>;
export default sqliteRuntimeDriverDescriptor;
