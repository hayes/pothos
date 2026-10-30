// The ORM hashes contracts and SQL with `node:crypto`, synchronously, which WebCrypto can't do.
const K = new Uint32Array(64);
const H = new Uint32Array(8);
{
  let count = 0;
  for (let n = 2; count < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) {
      const fraction = (x: number) => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
      if (count < 8) {
        H[count] = fraction(Math.sqrt(n));
      }
      K[count] = fraction(Math.cbrt(n));
      count++;
    }
  }
}

function sha256(message: Uint8Array) {
  const padded = new Uint8Array(((message.length + 9 + 63) >> 6) << 6);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((message.length * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (message.length * 8) >>> 0);
  const hash = H.slice();
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        w[t] = view.getUint32(offset + t * 4);
      } else {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, i) => {
      hash[i] = (hash[i] + value) | 0;
    });
  }
  return [...hash].map((word) => word.toString(16).padStart(8, '0')).join('');
}

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') {
    throw new Error(`Unsupported hash in the playground: ${algorithm}`);
  }
  const chunks: Uint8Array[] = [];
  const hash = {
    update(data: string | Uint8Array) {
      chunks.push(typeof data === 'string' ? new TextEncoder().encode(data) : data);
      return hash;
    },
    digest(encoding: string) {
      if (encoding !== 'hex') {
        throw new Error(`Unsupported digest in the playground: ${encoding}`);
      }
      const message = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        message.set(chunk, offset);
        offset += chunk.length;
      }
      return sha256(message);
    },
  };
  return hash;
}

export function randomBytes(size: number) {
  return crypto.getRandomValues(new Uint8Array(size));
}
