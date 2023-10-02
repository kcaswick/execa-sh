import { escapeForDoubleQuote } from "./escape.js";

/**
 * Creates a new function with a new scope that only has access to the provided code.
 * @param code The code to be isolated in a new function scope.
 * @returns A new function with a new scope that only has access to the provided code.
 */
export function isolateScope(code: string): (global: Record<string, unknown>) => unknown {
  // quick string escape for inner strings
  code = escapeForDoubleQuote(code);

  let jailScript = "new Function(";

  // Blacklist all global scope values
  // eslint-disable-next-line guard-for-in
  for (const prop in global) {
    jailScript += `"${prop}", `;
  }

  // Disable eval/Function
  jailScript += `"eval", "Function", `;

  jailScript += `"(()=>0).__proto__.constructor = undefined; Function = undefined; ${code}");`;

  // To debug syntax errors:
  console.trace(JSON.stringify(jailScript));

  // Give us the Function object to make a call on.
  // eslint-disable-next-line no-eval
  return eval(jailScript);

  // jailInternal.call();
}
