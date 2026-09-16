/**
 * Runtime data crosses an HTTP boundary and is therefore less trustworthy than
 * the TypeScript types suggest. Keep malformed arrays and primitive values from
 * reaching JSX collection operations such as map/filter/some.
 */
export function isRuntimeRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function safeRecord(value: unknown): Record<string, any> {
  return isRuntimeRecord(value) ? value : {};
}

export function safeRecordArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value.filter(isRuntimeRecord) : [];
}
