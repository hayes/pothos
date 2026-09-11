'use client';

import { compilerLogger } from './logger';

export interface CompilationResult {
  success: boolean;
  code?: string;
  error?: string;
}

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<
  string,
  { resolve: (result: CompilationResult) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    // Create worker from the TypeScript file
    // Next.js will handle the compilation
    const createdWorker = new Worker(new URL('./compiler.worker.ts', import.meta.url));
    worker = createdWorker;

    createdWorker.addEventListener('message', (event) => {
      if (worker !== createdWorker) {
        return;
      }
      const message = event.data;

      if (message.type === 'ready') {
        compilerLogger.debug('Worker ready');
        return;
      }

      if (message.type === 'success') {
        const pending = pendingRequests.get(message.id);
        if (pending) {
          pending.resolve({
            success: true,
            code: message.code,
          });
          pendingRequests.delete(message.id);
        }
      } else if (message.type === 'error') {
        const pending = pendingRequests.get(message.id);
        if (pending) {
          pending.resolve({
            success: false,
            error: message.error,
          });
          pendingRequests.delete(message.id);
        }
      }
    });

    createdWorker.addEventListener('error', (error) => {
      if (worker !== createdWorker) {
        return;
      }
      console.error('[Compiler Worker] Error:', error);
      terminateWorker(new Error('Worker error'));
    });
  }

  return worker;
}

// Cap each compile at 15s. esbuild-wasm hangs silently on certain
// version mismatches and other init failures (see compiler.worker.ts);
// without a cap the UI sticks at "compiling" forever. 15s is far above
// any normal compile (typically <500ms) so legitimate slow paths still
// succeed.
const COMPILE_TIMEOUT_MS = 15000;

export function compileTypeScriptInWorker(
  code: string,
  filename = 'schema.ts',
): Promise<CompilationResult> {
  return new Promise((resolve, reject) => {
    const id = `compile-${++requestId}`;

    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        // Worker is wedged — terminate it so the next request gets a
        // fresh one rather than queuing behind a dead worker.
        terminateWorker(new Error(`Compile timed out after ${COMPILE_TIMEOUT_MS}ms`));
      }
    }, COMPILE_TIMEOUT_MS);

    pendingRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeoutId);
        reject(err);
      },
    });

    try {
      const worker = getWorker();
      worker.postMessage({
        type: 'compile',
        id,
        code,
        filename,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

export function terminateWorker(error = new Error('Compiler worker terminated')) {
  const previousWorker = worker;
  worker = null;
  previousWorker?.terminate();
  // Every caller must settle when its worker disappears, including other
  // requests queued behind the one that timed out.
  pendingRequests.forEach((pending) => {
    pending.reject(error);
  });
  pendingRequests.clear();
}
