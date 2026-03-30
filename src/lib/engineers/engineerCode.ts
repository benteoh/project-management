/**
 * Base engineer code: 1st letter of first name (upper) + 1st letter of last (upper) + 2nd of last (lower).
 * Example: Jane Doe → JDo. Missing characters use `X`.
 */
export function deriveEngineerCodeBase(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  const a = f.length > 0 ? f[0].toUpperCase() : "X";
  const b = l.length > 0 ? l[0].toUpperCase() : "X";
  const c = l.length > 1 ? l[1].toLowerCase() : "X";
  return `${a}${b}${c}`;
}
