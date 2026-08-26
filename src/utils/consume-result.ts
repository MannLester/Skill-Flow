export function consumeResult<T>(result: T | Promise<T>, handle: (value: T) => void, handleError?: (error: unknown) => void) {
  if (isPromise(result)) {
    void result.then(handle).catch((error) => handleError?.(error));
    return;
  }
  handle(result);
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === 'function';
}
