import SchemaBuilder from '../../src';
const builder = new SchemaBuilder<{}>({});
builder.queryType({
  fields: (t) => ({
    x: t.field({
      type: 'Boolean',
      args: {
        raceId: t.arg.string(),
        limit: t.arg.int({ required: true, defaultValue: 25 }),
        tags: t.arg.stringList({ required: true }),
        ids: t.arg.idList({ required: true, defaultValue: [] }),
      },
      resolve: (_r, args) => {
        // A) mutate — succeeds only if MUTABLE (not readonly)
        args.tags.push('x');
        // B) assign readonly[] — fails if MUTABLE
        const ro: readonly string[] = ['a'];
        // @ts-expect-error expect error if args.tags is mutable string[]
        args.tags = ro;
        // C) raceId nullable
        const r: string | null | undefined = args.raceId;
        // D) limit number
        const l: number = args.limit;
        void r; void l; void args.ids;
        return true;
      },
    }),
  }),
});
