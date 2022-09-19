
export function assert<T>(v: T, msg?: string): NonNullable<T> {
  if (v === null || v === undefined) {
    throw new Error(msg || "Null or undefined not allowed");
  }
  return v as NonNullable<T>;
}

export function fail(msg?: string): never {
  throw new Error(msg || "Should not happen");
}

export function isFunction<D>(v: D | (() => D)): v is () => D {
  return v && typeof v === "function";
}
