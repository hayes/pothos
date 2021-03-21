export * from './connections';
export * from './resolve-nodes';

export function encodeGlobalID(typename: string, id: bigint | number | string) {
  return Buffer.from(`${typename}:${id}`).toString('base64');
}

export function decodeGlobalID(globalID: string) {
  const [typename, id] = Buffer.from(globalID, 'base64').toString().split(':');

  if (!typename || !id) {
    throw new TypeError(`Invalid global ID: ${globalID}`);
  }

  return { typename, id };
}
