import { PrismaClient } from '../prisma/client';
import { pubsub } from './pubsub';

export const db = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        if (
          operation === 'create' ||
          operation === 'update' ||
          operation === 'delete' ||
          operation === 'deleteMany' ||
          operation === 'updateMany' ||
          operation === 'createMany'
        ) {
          console.log(`🚀 ${operation} ${model}`);
          pubsub.publish(`dbUpdated${model}`, {});
        }
        return result;
      },
    },
  },
});
