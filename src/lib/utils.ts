/** Join class names, dropping falsy values: `clsx("a", cond && "b")`. */
export function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
