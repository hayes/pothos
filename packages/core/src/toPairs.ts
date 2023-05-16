// Taken from remeda https://github.com/remeda/remeda/blob/1082bc6ffa4711c162426af7028279a0a267272a/src/toPairs.ts
type ObjectKeys<T extends object> = `${Exclude<keyof T, symbol>}`;
type ObjectValues<T extends Record<PropertyKey, unknown>> = Required<T>[ObjectKeys<T>];
type ObjectEntry<T extends Record<PropertyKey, unknown>> = [ObjectKeys<T>, ObjectValues<T>];
type ObjectEntries<T extends Record<PropertyKey, unknown>> = ObjectEntry<T>[];

export function toPairs<T extends Record<PropertyKey, unknown>>(object: T): ObjectEntries<T> {
  // @ts-expect-error [ts2322] - This is deliberately stricter than what TS
  // provides out of the box.
  return Object.entries(object);
}
