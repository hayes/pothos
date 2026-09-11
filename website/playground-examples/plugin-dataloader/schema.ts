import SchemaBuilder from '@pothos/core';
import DataloaderPlugin from '@pothos/plugin-dataloader';

type UserShape = { id: string; username: string };
type Context = { batches?: string[][] };
const users: UserShape[] = [
  { id: '1', username: 'Ada' },
  { id: '2', username: 'Grace' },
  { id: '3', username: 'Katherine' },
];
const builder = new SchemaBuilder<{ Context: Context }>({ plugins: [DataloaderPlugin] });

// #region loadable-user
const User = builder.loadableObject('User', {
  load: async (ids: string[], context: Context) => {
    context.batches ??= [];
    context.batches.push([...ids]);
    // This source deliberately returns storage order, not requested order.
    return users.filter((user) => ids.includes(user.id));
  },
  sort: (user) => user.id,
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
  }),
});
// #endregion loadable-user

const BatchReport = builder
  .objectRef<{
    users: (UserShape | null)[];
    batchKeys: string[][];
    cachedAgain: boolean;
  }>('BatchReport')
  .implement({
    fields: (t) => ({
      users: t.field({
        type: [User],
        nullable: { list: false, items: true },
        resolve: (report) => report.users,
      }),
      batchKeys: t.field({
        type: t.listRef(t.listRef('String')),
        resolve: (report) => report.batchKeys,
      }),
      cachedAgain: t.exposeBoolean('cachedAgain'),
    }),
  });

builder.queryType({
  fields: (t) => ({
    users: t.field({
      type: [User],
      nullable: { list: false, items: true },
      args: { ids: t.arg.stringList({ required: true }) },
      resolve: (_parent, { ids }) => ids,
    }),
    // #region batching-report
    batching: t.field({
      type: BatchReport,
      args: { ids: t.arg.stringList({ required: true }) },
      resolve: async (_parent, { ids }, context) => {
        const loader = User.getDataloader(context);
        const loaded = await Promise.all(ids.map((id) => loader.load(id)));
        const before = context.batches?.length ?? 0;
        if (ids.length) {
          await loader.load(ids[0]);
        }
        return {
          users: loaded,
          batchKeys: context.batches ?? [],
          cachedAgain: (context.batches?.length ?? 0) === before,
        };
      },
    }),
    // #endregion batching-report
  }),
});
export const schema = builder.toSchema();
