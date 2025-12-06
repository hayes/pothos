import * as esbuild from 'esbuild-wasm';

let esbuildInitialized = false;
let initPromise: Promise<void> | null = null;

async function initEsbuild(): Promise<void> {
  if (esbuildInitialized) {
    return;
  }
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = esbuild
    .initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.1/esbuild.wasm',
    })
    .then(() => {
      esbuildInitialized = true;
    })
    .catch((err) => {
      // Reset on error so we can retry
      initPromise = null;
      throw err;
    });

  await initPromise;
}

interface CompileMessage {
  type: 'compile';
  id: string;
  code: string;
  filename: string;
}

interface CompileSuccessResponse {
  type: 'success';
  id: string;
  code: string;
}

interface CompileErrorResponse {
  type: 'error';
  id: string;
  error: string;
}

type WorkerMessage = CompileMessage;

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'compile') {
    try {
      await initEsbuild();

      const result = await esbuild.transform(message.code, {
        loader: message.filename.endsWith('.tsx') ? 'tsx' : 'ts',
        format: 'esm',
        target: 'es2020',
        sourcemap: false,
      });

      const response: CompileSuccessResponse = {
        type: 'success',
        id: message.id,
        code: result.code,
      };

      self.postMessage(response);
    } catch (err) {
      const error = err as Error;
      const response: CompileErrorResponse = {
        type: 'error',
        id: message.id,
        error: error.message,
      };

      self.postMessage(response);
    }
  }
});

// Signal that worker is ready
self.postMessage({ type: 'ready' });
