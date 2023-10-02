export function escapeForDoubleQuote(code: string): string {
  return code.replace(/["'\n`\\]/g, function (v) {
    return `\\${v}`;
  });
}
