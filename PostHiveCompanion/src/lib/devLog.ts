/** Strip verbose logs from production bundles when used consistently. */
export function devLog(...args: unknown[]): void {
  if (__DEV__) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (__DEV__) {
    console.warn(...args);
  }
}
