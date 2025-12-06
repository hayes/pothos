'use client';

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
    worker = new Worker(new URL('./compiler.worker.ts', import.meta.url));

    worker.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'ready') {
        console.log('[Compiler Worker] Ready');
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

    worker.addEventListener('error', (error) => {
      console.error('[Compiler Worker] Error:', error);
      // Reject all pending requests
      for (const pending of pendingRequests.values()) {
        pending.reject(new Error('Worker error'));
      }
      pendingRequests.clear();
    });
  }

  return worker;
}

export async function compileTypeScriptInWorker(
  code: string,
  filename = 'schema.ts',
): Promise<CompilationResult> {
  return new Promise((resolve, reject) => {
    const id = `compile-${++requestId}`;
    pendingRequests.set(id, { resolve, reject });

    try {
      const worker = getWorker();
      worker.postMessage({
        type: 'compile',
        id,
        code,
        filename,
      });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingRequests.clear();
  }
}
