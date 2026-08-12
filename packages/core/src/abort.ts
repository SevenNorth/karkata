export function createAbortError(): Error {
  return new DOMException('The operation was aborted', 'AbortError')
}

export function awaitWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(createAbortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => { signal.removeEventListener('abort', onAbort); if (!signal.aborted) resolve(value) },
      (error) => { signal.removeEventListener('abort', onAbort); if (!signal.aborted) reject(error) },
    ).catch(() => undefined)
  })
}

