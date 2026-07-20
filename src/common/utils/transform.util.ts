/** Typed class-transformer helpers to avoid unsafe `any` returns from `@Transform`. */

export function transformIfString(
  value: unknown,
  map: (input: string) => string | undefined | null,
): unknown {
  return typeof value === 'string' ? map(value) : value;
}
