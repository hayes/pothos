import builder from '../builder';

builder.interfaceType('Shape', {
  shape: t => ({
    name: t.exposeString('type', {
      permissionsCheck: 'readName',
      nullable: true,
    }),
  }),
});

builder.objectType('Square', {
  implements: ['Shape'],
  isType: parent => parent.type === 'square',
  defaultPermissionCheck: 'readSquare',
  postResolveCheck: () => {
    return { readSquare: true };
  },
  shape: t => ({
    size: t.float({
      resolve: ({ edgeLength }) => edgeLength ** 2,
    }),
  }),
});

builder.objectType('Triangle', {
  implements: ['Shape'],
  isType: parent => parent.type === 'triangle',
  defaultPermissionCheck: 'readTriangle',
  shape: t => ({
    edges: t.int({
      nullable: true,
      resolve: () => 3,
    }),
  }),
});

builder.objectType('Circle', {
  implements: ['Shape'],
  isType: parent => parent.type === 'circle',
  defaultPermissionCheck: 'readCircle',
  shape: t => ({
    area: t.int({
      resolve: ({ radius }) => Math.PI * radius ** 2,
    }),
  }),
});

const Polygon = builder.unionType('Polygon', {
  members: ['Square', 'Triangle'],
  resolveType: parent => {
    switch (parent.type) {
      case 'square':
        return 'Square';
      case 'triangle':
        return 'Triangle';
      default:
        throw new Error(`Unknown Polygon ${(parent as any).type}`);
    }
  },
});

builder.queryFields(t => ({
  square: t.field({
    type: 'Square',
    nullable: true,
    permissionsCheck: () => true,
    resolve: () => {
      return { type: 'square' as const, edgeLength: 4 };
    },
  }),
  shapes: t.field({
    type: ['Shape'],
    nullable: { items: true, list: false },
    permissionsCheck: () => true,
    grantPermissions: () => ({
      readName: true,
    }),
    resolve: () => {
      return [
        { type: 'circle', radius: 3 },
        { type: 'square', edgeLength: 4 },
        { type: 'triangle', edgeLength: 5 },
      ];
    },
  }),
  polygons: t.field({
    type: [Polygon],
    nullable: { items: true, list: false },
    permissionsCheck: () => true,
    grantPermissions: () => ({
      readName: true,
    }),
    resolve: async () => {
      return [
        { type: 'square' as const, edgeLength: 4 },
        { type: 'triangle' as const, edgeLength: 5 },
      ];
    },
  }),
}));
