import './poll';
import './numbers';
import builder from '../builder';

interface GlobalIDInputsShape {
  circular?: GlobalIDInputsShape;
  id: {
    id: string;
    typename: string;
  };
  idList: {
    id: string;
    typename: string;
  }[];
}

interface CircularWithoutGlobalIds {
  circular?: CircularWithoutGlobalIds;
  id?: number | string;
}

const GlobalIDInput = builder.inputRef<GlobalIDInputsShape>('GlobalIDInput');
const NoGlobalIDInput = builder.inputRef<CircularWithoutGlobalIds>('NoGlobalIDInput');

GlobalIDInput.implement({
  fields: (t) => ({
    circularWithoutGlobalIds: t.field({
      type: NoGlobalIDInput,
    }),
    circular: t.field({
      type: GlobalIDInput,
    }),
    id: t.globalID({
      required: true,
    }),
    idList: t.globalIDList({
      required: {
        list: true,
        items: true,
      },
    }),
  }),
});

NoGlobalIDInput.implement({
  fields: (t) => ({
    circular: t.field({
      type: NoGlobalIDInput,
    }),
    id: t.id({}),
  }),
});

builder.queryType({
  fields: (t) => ({
    inputGlobalID: t.string({
      args: {
        id: t.arg.globalID({
          required: true,
        }),
        normalId: t.arg.id({ required: true }),
        inputObj: t.arg({
          type: GlobalIDInput,
          required: true,
        }),
      },
      resolve(parent, args) {
        return JSON.stringify({
          normal: args.normalId,
          inputObj: {
            circular: {
              id: {
                id: args.inputObj.circular?.id.id,
                typename: args.inputObj.circular?.id.typename,
              },
              idList: args.inputObj.circular?.idList,
              circular: args.inputObj.circular?.circular,
            },
            id: {
              id: args.inputObj.id.id,
              typename: args.inputObj.id.typename,
            },
            idList: args.inputObj.idList?.map((id) => ({
              id: id.id,
              typename: id.typename,
            })),
          },
          id: {
            id: args.id.id,
            typename: args.id.typename,
          },
        });
      },
    }),
  }),
});

builder.mutationType({ fields: (t) => ({}) });

export default builder.toSchema({});
