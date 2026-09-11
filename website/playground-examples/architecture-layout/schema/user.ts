// src/schema/user.ts
import { builder } from '../builder';
import type { User as UserModel } from '../types';

export const User = builder.objectRef<UserModel>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryField('user', (t) =>
  t.field({
    type: User,
    resolve: () => ({ id: '1', name: 'Alex' }),
  }),
);
