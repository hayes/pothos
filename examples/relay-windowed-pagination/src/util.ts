import type { MaybePromise } from '@pothos/core';
import {
  type DefaultConnectionArguments,
  offsetToCursor,
  resolveOffsetConnection,
} from '@pothos/plugin-relay';
import type { PageCursor, PageCursors } from './types';

const DEFAULT_MAX_AROUND = 3;

// This is a fairly simple implementation that may not account for all edge cases.
export async function resolveWindowedConnection<T>(
  options: {
    args: DefaultConnectionArguments;
    defaultSize?: number;
    maxSize?: number;
    around?: number;
  },
  resolve: (params: {
    offset: number;
    limit: number;
  }) => MaybePromise<{ items: T[]; totalCount: number }>,
) {
  let pageCursors!: PageCursors;

  const result = await resolveOffsetConnection(options, async ({ limit, offset }) => {
    const pageSize = limit - 1;
    const { totalCount, items } = await resolve({ limit, offset });

    const lastPage = Math.max(Math.ceil(totalCount / pageSize), 1);
    const lastOffset = (lastPage - 1) * pageSize;
    const around: PageCursor[] = [];
    const maxAround = options.around ?? DEFAULT_MAX_AROUND;

    for (let i = -maxAround; i <= maxAround; i += 1) {
      const pageOffset = offset + i * pageSize;

      if (pageOffset < -1) {
        continue;
      }
      if (pageOffset >= totalCount) {
        break;
      }

      around.push({
        pageNumber: Math.floor(pageOffset / pageSize) + 1,
        cursor: offsetToCursor(pageOffset - 1),
        isCurrent: pageOffset === offset,
      });
    }

    pageCursors = {
      first: { cursor: offsetToCursor(-1), pageNumber: 1, isCurrent: offset === 0 },
      around,
      last: {
        cursor: offsetToCursor(lastOffset - 1),
        pageNumber: lastPage,
        isCurrent: offset === lastOffset,
      },
    };

    return items;
  });

  return { ...result, pageCursors };
}
