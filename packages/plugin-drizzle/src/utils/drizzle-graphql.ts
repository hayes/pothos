// import {
//   type Column,
//   type SQL,
//   type TableRelationalConfig,
//   asc,
//   desc,
//   operators as ops,
// } from 'drizzle-orm';
// import { GraphQLError } from 'graphql';

// // biome-ignore lint/suspicious/noExplicitAny: <explanation>
// export const remapFromGraphQLCore = (value: any, column: Column, columnName: string) => {
//   switch (column.dataType) {
//     case 'date': {
//       const formatted = new Date(value);
//       if (Number.isNaN(formatted.getTime())) {
//         throw new GraphQLError(`Field '${columnName}' is not a valid date!`);
//       }

//       return formatted;
//     }

//     case 'buffer': {
//       if (!Array.isArray(value)) {
//         throw new GraphQLError(`Field '${columnName}' is not an array!`);
//       }

//       return Buffer.from(value);
//     }

//     case 'json': {
//       if (column.columnType === 'PgGeometryObject') {
//         return value;
//       }

//       try {
//         return JSON.parse(value);
//       } catch (e) {
//         throw new GraphQLError(
//           `Invalid JSON in field '${columnName}':\n${e instanceof Error ? e.message : 'Unknown error'}`,
//         );
//       }
//     }

//     case 'array': {
//       if (!Array.isArray(value)) {
//         throw new GraphQLError(`Field '${columnName}' is not an array!`);
//       }

//       if (column.columnType === 'PgGeometry' && value.length !== 2) {
//         throw new GraphQLError(
//           `Invalid float tuple in field '${columnName}': expected array with length of 2, received ${value.length}`,
//         );
//       }

//       return value;
//     }

//     case 'bigint': {
//       try {
//         return BigInt(value);
//       } catch (_error) {
//         throw new GraphQLError(`Field '${columnName}' is not a BigInt!`);
//       }
//     }

//     default: {
//       return value;
//     }
//   }
// };

// export const remapFromGraphQLSingleInput = (
//   // biome-ignore lint/suspicious/noExplicitAny: <explanation>
//   queryInput: Record<string, any>,
//   table: TableRelationalConfig,
// ) => {
//   for (const [key, value] of Object.entries(queryInput)) {
//     if (value === undefined) {
//       delete queryInput[key];
//     } else {
//       const column = table.columns[key];
//       if (!column) {
//         throw new GraphQLError(`Unknown column: ${key}`);
//       }

//       if (value === null && (column as Column).notNull) {
//         delete queryInput[key];
//         continue;
//       }

//       queryInput[key] = remapFromGraphQLCore(value, column as Column, key);
//     }
//   }

//   return queryInput;
// };

// export const remapFromGraphQLArrayInput = (
//   // biome-ignore lint/suspicious/noExplicitAny: <explanation>
//   queryInput: Record<string, any>[],
//   table: TableRelationalConfig,
// ) => {
//   for (const entry of queryInput) {
//     remapFromGraphQLSingleInput(entry, table);
//   }

//   return queryInput;
// };

// export type OrderByArgs<TTable extends TableRelationalConfig> = {
//   [Key in keyof TTable['columns']]?: {
//     direction: 'asc' | 'desc';
//     priority: number;
//   };
// };

// export const extractOrderBy = <
//   TTable extends TableRelationalConfig,
//   // biome-ignore lint/suspicious/noExplicitAny: <explanation>
//   TArgs extends OrderByArgs<any> = OrderByArgs<TTable>,
// >(
//   table: TTable,
//   orderArgs: TArgs,
// ): SQL[] => {
//   const res = [] as SQL[];

//   for (const [column, config] of Object.entries(orderArgs).sort(
//     (a, b) => (b[1]?.priority ?? 0) - (a[1]?.priority ?? 0),
//   )) {
//     if (!config) {
//       continue;
//     }
//     const { direction } = config;

//     res.push(direction === 'asc' ? asc(table.columns[column]!) : desc(table.columns[column]!));
//   }

//   return res;
// };

// export const extractFiltersColumn = <TColumn extends Column>(
//   column: TColumn,
//   columnName: string,
//   operators: Record<string, unknown> & { OR?: Record<string, unknown>[] },
// ): SQL | undefined => {
//   if (!operators.OR?.length) {
//     // biome-ignore lint/performance/noDelete: <explanation>
//     delete operators.OR;
//   }

//   const entries = Object.entries(operators);

//   if (operators.OR) {
//     if (entries.length > 1) {
//       throw new GraphQLError(
//         `WHERE ${columnName}: Cannot specify both fields and 'OR' in column operators!`,
//       );
//     }

//     const variants = [] as SQL[];

//     for (const variant of operators.OR) {
//       const extracted = extractFiltersColumn(column, columnName, variant);

//       // biome-ignore lint/style/useBlockStatements: <explanation>
//       if (extracted) variants.push(extracted);
//     }

//     return variants.length ? (variants.length > 1 ? ops.or(...variants) : variants[0]) : undefined;
//   }

//   const variants = [] as SQL[];
//   for (const [operatorName, operatorValue] of entries) {
//     // biome-ignore lint/style/useBlockStatements: <explanation>
//     if (operatorValue === null || operatorValue === false) continue;

//     switch (operatorName) {
//       case 'eq':
//       case 'ne':
//       case 'gt':
//       case 'gte':
//       case 'lt':
//       case 'lte': {
//         const singleValue = remapFromGraphQLCore(operatorValue, column, columnName);
//         variants.push(ops[operatorName](column, singleValue));

//         break;
//       }
//       case 'like':
//       case 'notLike':
//       case 'ilike':
//       case 'notIlike':
//         variants.push(ops[operatorName](column, operatorValue as string));
//         break;
//       case 'inArray':
//       case 'notInArray': {
//         // biome-ignore lint/suspicious/noExplicitAny: <explanation>
//         if (!(operatorValue as any[]).length) {
//           throw new GraphQLError(
//             `WHERE ${columnName}: Unable to use operator ${operatorName} with an empty array!`,
//           );
//         }
//         // biome-ignore lint/suspicious/noExplicitAny: <explanation>
//         const arrayValue = (operatorValue as any[]).map((val) =>
//           remapFromGraphQLCore(val, column, columnName),
//         );

//         variants.push(ops[operatorName](column, arrayValue));
//         break;
//       }
//       case 'isNull':
//       case 'isNotNull':
//         variants.push(ops[operatorName](column));
//         break;
//       default:
//         throw new GraphQLError(`Unknown operator: ${operatorName}`);
//     }
//   }

//   return variants.length ? (variants.length > 1 ? ops.and(...variants) : variants[0]) : undefined;
// };

// export const extractFilters = <TTable extends TableRelationalConfig>(
//   table: TTable,
//   tableName: string,
//   filters: Record<string, unknown> & {
//     OR?: Record<string, unknown>[];
//   },
// ): SQL | undefined => {
//   if (!filters.OR?.length) {
//     // biome-ignore lint/performance/noDelete: <explanation>
//     delete filters.OR;
//   }

//   const entries = Object.entries(filters);
//   if (!entries.length) {
//     return;
//   }

//   if (filters.OR) {
//     if (entries.length > 1) {
//       throw new GraphQLError(
//         `WHERE ${tableName}: Cannot specify both fields and 'OR' in table filters!`,
//       );
//     }

//     const variants = [] as SQL[];

//     for (const variant of filters.OR) {
//       const extracted = extractFilters(table, tableName, variant);
//       if (extracted) {
//         variants.push(extracted);
//       }
//     }

//     return variants.length ? (variants.length > 1 ? ops.or(...variants) : variants[0]) : undefined;
//   }

//   const variants = [] as SQL[];
//   for (const [columnName, operators] of entries) {
//     if (operators === null) {
//       continue;
//     }

//     const column = table.columns[columnName]!;
//     variants.push(
//       extractFiltersColumn(column as Column, columnName, operators as Record<string, unknown>)!,
//     );
//   }

//   return variants.length ? (variants.length > 1 ? ops.and(...variants) : variants[0]) : undefined;
// };
