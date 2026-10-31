import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// The ORM hashes contracts and SQL with `node:crypto`, synchronously, which WebCrypto can't do.
export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') {
    throw new Error(`Unsupported hash in the playground: ${algorithm}`);
  }
  const state = sha256.create();
  const hash = {
    update(data: string | Uint8Array) {
      state.update(typeof data === 'string' ? utf8ToBytes(data) : data);
      return hash;
    },
    digest(encoding: string) {
      if (encoding !== 'hex') {
        throw new Error(`Unsupported digest in the playground: ${encoding}`);
      }
      return bytesToHex(state.digest());
    },
  };
  return hash;
}

export function randomBytes(size: number) {
  return crypto.getRandomValues(new Uint8Array(size));
}
