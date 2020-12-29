import SchemaBuilder from '../../src';

export const nullableFieldBuilder = new SchemaBuilder<{
  DefaultFieldNullability: true;
}>({
  defaultFieldNullability: true,
});

export const nonNullableFieldBuilder = new SchemaBuilder<{
  DefaultInputFieldNullability: false;
}>({
  defaultInputFieldNullability: false,
});

nullableFieldBuilder.queryType({
  fields: (t) => ({
    nullable: t.boolean({
      resolve: () => null,
    }),
    nonNullable: t.boolean({
      nullable: false,
      resolve: () => false,
    }),
    nonNullableError: t.boolean({
      nullable: false,
      // @ts-expect-error
      resolve: () => null,
    }),
    nullableList: t.booleanList({
      resolve: () => null,
    }),
    nullableListError: t.booleanList({
      resolve: () => [
        false,
        // @ts-expect-error
        null,
      ],
    }),
    nonNullableList: t.booleanList({
      nullable: false,
      resolve: () => [false],
    }),
    nonNullableListError: t.booleanList({
      nullable: false,
      // @ts-expect-error
      resolve: () => null,
    }),
    nullableListItems: t.booleanList({
      nullable: {
        items: true,
        list: false,
      },
      resolve: () => [false, null],
    }),
    nullableListItemsError: t.booleanList({
      nullable: {
        items: true,
        list: false,
      },
      // @ts-expect-error
      resolve: () => null,
    }),
    explicitNullableList: t.booleanList({
      nullable: {
        items: false,
        list: true,
      },
      resolve: () => null,
    }),
    explicitNullableListError: t.booleanList({
      nullable: {
        items: false,
        list: true,
      },
      resolve: () => [
        true,
        // @ts-expect-error
        null,
      ],
    }),
    bothNull: t.booleanList({
      nullable: {
        items: true,
        list: true,
      },
      resolve: () => [true, null],
    }),
    bothNull2: t.booleanList({
      nullable: {
        items: true,
        list: true,
      },
      resolve: () => null,
    }),
    inputFields: t.boolean({
      nullable: false,
      args: {
        nullable: t.arg.boolean({}),
        nonNullable: t.arg.boolean({
          required: true,
        }),
        nullableList: t.arg.booleanList({}),
        nonNullableList: t.arg.booleanList({
          required: true,
        }),
        nullableListItems: t.arg.booleanList({
          required: {
            list: true,
            items: false,
          },
        }),
        nonNullableListItems: t.arg.booleanList({
          required: true,
        }),
        bothNullable: t.arg.booleanList({
          required: {
            list: false,
            items: false,
          },
        }),
      },
      resolve: (parent, args) => {
        expectNullable(args.nullable);
        expectNonNullable(args.nonNullable);
        expectNullable(args.nullableList);
        expectNonNullable(args.nonNullableList);
        expectNullable(args.nullableListItems[0]);
        expectNonNullable(args.nonNullableListItems[0]);
        expectNullable(args.bothNullable);
        expectNullable(args.bothNullable![0]);

        return false;
      },
    }),
  }),
});

nonNullableFieldBuilder.queryType({
  fields: (t) => ({
    nullable: t.boolean({
      nullable: true,
      resolve: () => null,
    }),
    nullableList: t.booleanList({
      nullable: true,
      resolve: () => null,
    }),
    nonNullable: t.boolean({
      resolve: () => false,
    }),
    nonNullableError: t.boolean({
      // @ts-expect-error
      resolve: () => null,
    }),
    nullableListError: t.booleanList({
      nullable: true,
      resolve: () => [
        false,
        // @ts-expect-error
        null,
      ],
    }),
    nonNullableList: t.booleanList({
      resolve: () => [false],
    }),
    nonNullableListError: t.booleanList({
      // @ts-expect-error
      resolve: () => null,
    }),
    nullableListItems: t.booleanList({
      nullable: {
        items: true,
        list: false,
      },
      resolve: () => [false, null],
    }),
    nullableListItemsError: t.booleanList({
      nullable: {
        items: true,
        list: false,
      },
      // @ts-expect-error
      resolve: () => null,
    }),
    explicitNullableList: t.booleanList({
      nullable: {
        items: false,
        list: true,
      },
      resolve: () => null,
    }),
    explicitNullableListError: t.booleanList({
      nullable: {
        items: false,
        list: true,
      },
      resolve: () => [
        true,
        // @ts-expect-error
        null,
      ],
    }),
    bothNull: t.booleanList({
      nullable: {
        items: true,
        list: true,
      },
      resolve: () => [true, null],
    }),
    bothNull2: t.booleanList({
      nullable: {
        items: true,
        list: true,
      },
      resolve: () => null,
    }),
    inputFields: t.boolean({
      nullable: false,
      args: {
        nullable: t.arg.boolean({
          required: false,
        }),
        nonNullable: t.arg.boolean({}),
        nullableList: t.arg.booleanList({
          required: false,
        }),
        nonNullableList: t.arg.booleanList({}),
        nullableListItems: t.arg.booleanList({
          required: {
            list: true,
            items: false,
          },
        }),
        nonNullableListItems: t.arg.booleanList({}),
        bothNullable: t.arg.booleanList({
          required: {
            list: false,
            items: false,
          },
        }),
      },
      resolve: (parent, args) => {
        expectNullable(args.nullable);
        expectNonNullable(args.nonNullable);
        expectNullable(args.nullableList);
        expectNonNullable(args.nonNullableList);
        expectNullable(args.nullableListItems[0]);
        expectNonNullable(args.nonNullableListItems[0]);
        expectNullable(args.bothNullable);
        expectNullable(args.bothNullable![0]);

        return false;
      },
    }),
  }),
});

function expectNullable<T>(arg: null extends T ? T : never) {}
function expectNonNullable<T>(arg: null extends T ? never : T) {}
