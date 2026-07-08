export async function unwrapParams<T>(params: T | Promise<T>): Promise<T> {
  return params;
}
