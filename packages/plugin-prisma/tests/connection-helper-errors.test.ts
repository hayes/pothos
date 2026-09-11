import SchemaBuilder from '@pothos/core';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  AsyncSelections: true;
}>({
  plugins: [PrismaPlugin],
  prisma: { client: prisma, dmmf: getDatamodel() },
});

// Both the helper's select and the caller's nested selection can start asynchronous work
// before the query callback runs. Its synchronous failure must leave neither promise orphaned.
it.each([
  'helper',
  'nested',
] as const)('handles a pending %s selection when the query callback throws', async (source) => {
  const queryError = new Error('query failed');
  let rejectSelection!: (reason: Error) => void;
  const pending = new Promise<never>((_resolve, reject) => {
    rejectSelection = reject;
  });
  const helpers = prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    select: source === 'helper' ? () => pending : undefined,
    query: () => {
      throw queryError;
    },
  });
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);

  try {
    expect(() => helpers.getQuery({}, {}, () => pending, { awaitSelections: true })).toThrow(
      queryError,
    );
    rejectSelection(new Error('selection failed'));
    // Node reports an unhandled rejection after the current microtask queue drains.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
