export * from './connections.js';
export * from './resolve-nodes.js';

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

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
