import defineLazyProperty from "define-lazy-prop";
import { isString } from "remeda";
import TreeSitter from "tree-sitter";
import languageBash from "tree-sitter-bash";

import { isolateScope } from "./isolateScope.js";
import { ExecaChildProcess, execa } from "execa";
import { isPromise } from "util/types";
import { escapeForDoubleQuote } from "./escape.js";

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
  console.debug("DEBUG: " + tree.rootNode.toString());
  return tree;
}

type ICompiledSubtree<TResult = unknown> = {
  children: ICompiledSubtree[];
  fieldName: string;
  source: TreeSitter.SyntaxNode;
  text: string;
} & ( // TResult extends undefined ? { compiled: null; value: undefined } : { compiled: () => TResult; value: TResult });
  | {
      compiled: () => Promise<TResult> | TResult;
      name?: string;
      value?: TResult;
    }
  | {
      compiled: null;
      name?: undefined;
      value: undefined;
    }
);

/**
 * Compiles a TreeSitter tree of shell code into a function that starts the chlid process.
 * @param tree The TreeSitter tree to compile.
 * @returns A function that returns an `ExecaChildProcess`.
 */
export function compile(tree: TreeSitter.Tree): () => ExecaChildProcess {
  const cursor = tree.rootNode.walk();
  const wip: Partial<ICompiledSubtree> & Pick<ICompiledSubtree, "children"> = {
    children: [],
    source: cursor.currentNode,
  };

  if (cursor.gotoFirstChild()) {
    wip.children.push(...processSubtree(cursor));
    cursor.gotoParent();
  } else {
    console.warn("No children found");
  }

  const compiledChildren = wip.children
    .map((child) => child.compiled)
    .filter((child) => child !== null && child !== undefined) as (() => Promise<unknown> | unknown)[];
  if (compiledChildren.length === 1) {
    wip.compiled = compiledChildren[0];
  } else if (compiledChildren.length === 2) {
    const [first, second] = compiledChildren;
    wip.compiled = async () => {
      await first();
      return second();
    };
  } else {
    wip.compiled = () => {
      compiledChildren.reduce<Promise<unknown> | unknown>(async (previous, current) => {
        if (isPromise(previous)) {
          return previous.then(current);
        }

        return current();
      }, Promise.resolve());
    };
  }

  console.debug(`DEBUG: compiled code: ${wip.compiled.toString()}`);

  wip.text = wip.children.map((child) => child.text).join("\n");
  console.debug(`DEBUG: compiled text: ${wip.text}`);

  const scopeFunction = isolateScope(`
  class Scope {
    exec(fn) {
      return fn;
    }
  };
  return new Scope();
  `) as (global: Record<string, unknown>) => { exec(fn: () => unknown): () => ExecaChildProcess };
  console.debug(`DEBUG: scopeFunction: ${scopeFunction.toString()}`);
  const scope = scopeFunction({});
  console.debug(`DEBUG: scope: `, scope);

  const result = scope.exec(wip.compiled);

  return result as () => ExecaChildProcess;
}

function processCommand(
  currentNode: TreeSitter.SyntaxNode,
  cursor: TreeSitter.TreeCursor,
  children: ICompiledSubtree[]
): ICompiledSubtree<ExecaChildProcess> {
  console.debug("DEBUG: " + currentNode.text, currentNode, currentNode.children);
  const commandNameNodes = currentNode.descendantsOfType("command_name");
  const command =
    commandNameNodes.length === 1
      ? commandNameNodes[0].firstChild?.text
      : (() => {
          throw new Error(
            `Did not expect ${commandNameNodes.length} command_name nodes: ${commandNameNodes.map((n) => n.text).join(", ")}`
          );
        })();

  const commandNameCompiled = children.filter((child) => child.source.type === "command_name");
  const commandName = commandNameCompiled.map((child) => child.value).join(" ");

  const argumentsCompiled = children.filter((child) => child.fieldName === "argument");
  const redirectsCompiled = children.filter((child) => child.source.type === "file_redirect");
  const assignmentsCompiled = children.filter((child) => child.source.type === "variable_assignment");

  return {
    children,
    compiled: () => {
      // TODO: Pick by command type, might want to execaNode for shx built-ins
      const childProcess = execa(
        commandName,
        argumentsCompiled.map((child) => {
          const result = child.value ?? child.compiled?.();
          if (result === null || result === undefined) {
            return "";
          }

          if (typeof result === "string") {
            return result;
          }

          return result.toString();
        }),
        {
          env: Object.fromEntries(assignmentsCompiled.map((child) => [child.name, child.value ?? child.compiled?.()])),
        }
      );
      // TODO: Handle redirects
      return childProcess;
    },
    fieldName: cursor.currentFieldName,
    source: currentNode,
    text: `return execa(${commandName}, [${argumentsCompiled.map((child) => child.text).join(", ")}], { env: { ${assignmentsCompiled
      .map((child) => `${child.name}: ${child.text}`)
      .join(", ")} } })`,
  };
}

function processCommandName(cursor: TreeSitter.TreeCursor, currentNode: TreeSitter.SyntaxNode, children: ICompiledSubtree[]) {
  // Should always be a single child
  if (children.every((child) => child.value)) {
    return {
      children,
      compiled: () => children.map((child) => child.value).join(" "),
      source: currentNode,
      text: `"${escapeForDoubleQuote(children.map((child) => child.text).join(" "))}"`,
      value: children.map((child) => child.value).join(" "),
    };
  }

  return {
    children,
    compiled: () => children.map((child) => child.compiled?.()).join(" "),
    source: currentNode,
    text: `"${escapeForDoubleQuote(children.map((child) => child.text).join(" "))}"`,
    value: undefined,
  };
}

function processComment(currentNode: TreeSitter.SyntaxNode, fieldName: string): ICompiledSubtree<undefined> {
  if (currentNode.childCount > 0) {
    currentNode.children.forEach((child) => {
      console.debug("DEBUG: " + child.toString());
    });
  }

  return {
    children: [],
    compiled: null,
    fieldName: fieldName,
    source: currentNode,
    text: currentNode.text.replace(/^(\s*)#/, "$1//"),
    value: undefined,
  };
}

function processExpansion(
  cursor: TreeSitter.TreeCursor,
  currentNode: TreeSitter.SyntaxNode,
  children: ICompiledSubtree[]
): Partial<ICompiledSubtree<unknown>> {
  const operator = children.filter((child) => child.fieldName === "operator");
  if (operator.length > 0) {
    throw new Error(`Operators in expansions are not supported: ${operator.map((child) => child.text).join(", ")}`);
  }

  throw new Error("Function not implemented.");
}

function processSimpleExpansion(cursor: TreeSitter.TreeCursor, currentNode: TreeSitter.SyntaxNode, children: ICompiledSubtree[]) {
  if (children.length > 1) {
    throw new Error(`Expected 1 child, got ${children.length}`);
  }

  if (children[0].source.type !== "variable_name" && children[0].source.type !== "special_variable_name") {
    throw new Error(
      `Expected variable name, got ${children[0].source.type} :${children[0].source.startPosition.row}:${children[0].source.startPosition.column}`
    );
  }

  const varName = children[0].value;

  if (!isString(varName)) {
    throw new Error(`Expected string for variable name, got ${typeof varName}`);
  }

  return {
    children,
    // TODO: Support variables that haven't been exported
    compiled: () => process.env[varName],
    fieldName: cursor.currentFieldName,
    name: varName,
    source: currentNode,
    text: `process.env.${escapeIdentifier(varName)}`,
  };
}

function processSubtree(cursor: TreeSitter.TreeCursor): ICompiledSubtree[] {
  const result: Partial<ICompiledSubtree>[] = [];
  do {
    const currentNode = cursor.currentNode;
    console.debug("DEBUG: " + currentNode.toString());
    if (!currentNode.isNamed) {
      continue;
    }

    const hasChildren = cursor.gotoFirstChild();
    const children = hasChildren ? processSubtree(cursor) : [];
    if (hasChildren) cursor.gotoParent();

    switch (currentNode.type) {
      case "command":
        result.push(processCommand(currentNode, cursor, children));

        break;

      case "command_name":
        result.push(processCommandName(cursor, currentNode, children));

        break;

      case "comment":
        result.push(processComment(currentNode, cursor.currentFieldName));
        break;

      case "concatenation":
      case "string":
        {
          let text: string;
          let value: string;
          if (children.length > 0) {
            text = children.map((child) => child.text).join("");
            value = children.map((child) => child.value).join("");
          } else {
            text = currentNode.text;
            value = JSON.parse(currentNode.text);
          }

          if (children.every((child) => child.value) || children.length === 0) {
            result.push({
              children,
              compiled: () => value,
              fieldName: cursor.currentFieldName,
              source: currentNode,
              text,
              value,
            });
          } else {
            result.push({
              children,
              compiled: () => children.map((child) => child.value ?? child.compiled?.()).join(""),
              fieldName: cursor.currentFieldName,
              source: currentNode,
              text,
              value: undefined,
            });
          }
        }

        break;

      case "expansion":
        result.push(processExpansion(cursor, currentNode, children));
        break;

      case "simple_expansion":
        result.push(processSimpleExpansion(cursor, currentNode, children));
        break;

      case "variable_name":
        result.push({
          children: [],
          compiled: () => currentNode.text,
          fieldName: cursor.currentFieldName,
          source: currentNode,
          name: currentNode.text,
          text: currentNode.text,
          value: currentNode.text,
        });
        break;

      case "ansi_c_string":
      case "word":
        result.push({
          children: [],
          compiled: () => currentNode.text,
          fieldName: cursor.currentFieldName,
          source: currentNode,
          text: `"${currentNode.text}"`,
          value: currentNode.text,
        });
        break;

      default: {
        const message = `Unhandled node type: ${currentNode.type} (${currentNode.text}) for '${cursor.currentFieldName}'`;
        console.debug(`DEBUG: ${message}`);
        result.push({
          children,
          compiled: () => {
            throw new Error(message);
          },
          fieldName: cursor.currentFieldName,
          source: currentNode,
          text: `/* ${message} */`,
          value: undefined,
        });
      }
    }
  } while (cursor.gotoNextSibling());

  return result as ICompiledSubtree[];
}

function escapeIdentifier(identifier: string) {
  // TODO: Actually implement this, so property names with spaces and funny chars work
  return identifier;
}
