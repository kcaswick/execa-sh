import defineLazyProperty from "define-lazy-prop";
import {} from "remeda";
import TreeSitter from "tree-sitter";
import languageBash from "tree-sitter-bash";

import { isolateScope } from "./isolateScope.js";
import { ExecaChildProcess } from "execa";

const it = {} as { parser: TreeSitter };
defineLazyProperty(it, "parser", () => {
  const p = new TreeSitter();
  p.setLanguage(languageBash);
  return p;
});

/**
 * Parses a string of shell code and returns a CST.
 * @param code The code to parse.
 * @returns The CST of the parsed code.
 */
export function parse(code: string) {
  const tree = it.parser.parse(code);
  console.trace(tree.rootNode.toString());
  return tree;
}

/**
 * Compiles a TreeSitter tree of shell code into a function that starts the chlid process.
 * @param tree The TreeSitter tree to compile.
 * @returns A function that returns an `ExecaChildProcess`.
 */
export function compile(tree: TreeSitter.Tree): () => ExecaChildProcess {
  const cursor = tree.walk();
  while (cursor.gotoNextSibling()) {
    console.trace(cursor.currentNode.toString());
  }

  cursor.gotoParent();

  const result = isolateScope(`throw new Error("Not implemented yet");`);

  return result as () => ExecaChildProcess;
}
