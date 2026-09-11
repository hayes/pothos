import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const port = process.env.PLAYGROUND_TEST_PORT ?? '4322';
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'start', '--port', port],
  { stdio: 'inherit' },
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`Website exited: ${server.exitCode}`);
    }
    try {
      ready = (await fetch(`${origin}/playground`)).ok;
    } catch {}
    if (ready) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    throw new Error('Website did not become ready');
  }
  for (const script of [
    'check-playground.mjs',
    'check-landing-playground.mjs',
    'check-doc-links.mjs',
  ]) {
    const test = spawn(process.execPath, [`scripts/${script}`, origin], { stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => {
      test.on('error', reject);
      test.on('exit', resolve);
    });
    if (code !== 0) {
      throw new Error(`${script} exited ${code}`);
    }
  }
} finally {
  server.kill('SIGTERM');
}
