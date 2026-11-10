import { type PrismaTypesFromClient } from '../../src';
import { Prisma } from '../client/client.js';
export declare const queries: unknown[];
export declare const prisma: import("@prisma/client/runtime/client").DynamicClientExtensionThis<Prisma.TypeMap<import("@prisma/client/runtime/client").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, Prisma.GlobalOmitConfig | undefined>, Prisma.TypeMapCb<Prisma.GlobalOmitConfig | undefined>, {
    result: {};
    model: {};
    query: {};
    client: {};
}>;
type PrismaTypes = PrismaTypesFromClient<typeof prisma>;
interface Types {
    Scalars: {
        Decimal: {
            Input: Prisma.Decimal;
            Output: Prisma.Decimal;
        };
    };
    Context: {
        user: {
            id: number;
        };
    };
    PrismaTypes: PrismaTypes;
    AuthScopes: {
        user: boolean;
    };
}
declare const builder: PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<Types>>;
export default builder;
