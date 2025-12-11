'use client';

export interface CacheEntry {
  code: string;
  compiledCode: string;
  timestamp: number;
}

const DB_NAME = 'pothos-playground';
const STORE_NAME = 'schema-cache';
const DB_VERSION = 1;
const MAX_CACHE_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'code' });
      }
    };
  });

  return dbPromise;
}

/**
 * Generate a cache key from code content
 */
function getCacheKey(code: string): string {
  // Use the code itself as the key (IndexedDB can handle strings efficiently)
  return code;
}

/**
 * Get cached compiled code for the given source code
 */
export async function getCachedSchema(code: string): Promise<string | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const key = getCacheKey(code);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if cache entry is stale
        const age = Date.now() - entry.timestamp;
        if (age > MAX_CACHE_AGE) {
          // Cache is stale, remove it
          deleteCachedSchema(code).catch(() => {
            // Ignore deletion errors
          });
          resolve(null);
          return;
        }

        resolve(entry.compiledCode);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[Playground Cache] Failed to get cached schema:', error);
    return null;
  }
}

/**
 * Cache compiled code for the given source code
 */
export async function setCachedSchema(code: string, compiledCode: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const entry: CacheEntry = {
      code: getCacheKey(code),
      compiledCode,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[Playground Cache] Failed to cache schema:', error);
  }
}

/**
 * Delete cached schema for the given code
 */
export async function deleteCachedSchema(code: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const key = getCacheKey(code);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[Playground Cache] Failed to delete cached schema:', error);
  }
}

/**
 * Clear all cached schemas
 */
export async function clearSchemaCache(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[Playground Cache] Failed to clear cache:', error);
  }
}
