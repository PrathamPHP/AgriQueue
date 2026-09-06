import React from 'react';

/**
 * Resilient lazy-loading utility that wraps React.lazy with:
 * 1. Automatic retry on fetch failure (handles transient network lag, dev server HMR/reloads, chunk contention)
 * 2. Export normalization (resolves default export or named export gracefully)
 * 3. Preload capability for instant persona switching
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  exportName?: string,
  retries: number = 3,
  interval: number = 200
): React.LazyExoticComponent<T> {
  return React.lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (attemptsLeft: number) => {
        factory()
          .then((module) => {
            let component: any;
            if (exportName && module && module[exportName]) {
              component = module[exportName];
            } else if (module && module.default) {
              component = module.default;
            } else if (module) {
              // Look for any function/component export
              const keys = Object.keys(module);
              const named = keys.find((k) => typeof module[k] === 'function');
              component = named ? module[named] : module;
            }

            if (!component) {
              reject(new Error('Failed to resolve component export from module.'));
              return;
            }

            resolve({ default: component });
          })
          .catch((error: any) => {
            if (attemptsLeft <= 1) {
              console.error(
                `[lazyWithRetry] All ${retries} attempts to fetch dynamic module failed:`,
                error
              );
              reject(error);
              return;
            }

            const delay = interval * (retries - attemptsLeft + 1);
            console.warn(
              `[lazyWithRetry] Module fetch error (${error?.message || error}). Retrying in ${delay}ms (${attemptsLeft - 1} attempts left)...`
            );

            setTimeout(() => {
              attempt(attemptsLeft - 1);
            }, delay);
          });
      };

      attempt(retries);
    });
  });
}

/**
 * Preload a dynamic import in idle time or on user interaction
 */
export function preloadModule(factory: () => Promise<any>): void {
  try {
    factory().catch(() => {
      // Ignore background preload errors; the route-level lazyWithRetry will retry on actual mount
    });
  } catch {
    // Suppress synchronous preload errors
  }
}
