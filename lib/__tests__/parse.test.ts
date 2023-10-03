import { describe, expect, it } from "vitest";
import { parse, compile } from "../parse.js";

describe("parse", () => {
  it("should parse a string of shell code and return a CST", () => {
    const code = `
      echo "Hello, world!"
    `;
    const result = parse(code);
    expect(result.rootNode.toString()).toBe("(program (command name: (command_name (word)) argument: (string)))");
  });
});

describe("compile", () => {
  it("compile shell code into a function that starts the child process", () => {
    const code = `
      echo "Hello, world!"
    `;

    const tree = parse(code);
    const result = compile(tree); // Result should be identical to () => execa.$`echo ${"Hello, world!"}`

    console.debug(result.toString());
    expect(typeof result).toBe("function");

    const execution = result();
    expect(execution.spawnfile).toBe("echo");
    expect(execution.spawnargs).toEqual(["echo", "Hello, world!"]);

    expect(execution).resolves.toHaveProperty("stdout", "Hello, world!");
    expect(execution).resolves.toHaveProperty("exitCode", 0);
  });

  it("compile sequence of commands", async () => {
    const code = `
    echo "Hello..."; echo "world!";
    # Test sequential commands
  `;

    const tree = parse(code);
    const result = compile(tree); // Result should be identical to () => execa.$`echo ${"Hello, world!"}`

    expect(typeof result).toBe("function");
    console.debug(result.toString());

    const execution = result();
    const executed = await execution;

    expect(executed.stdout).toEqual("Hello...\nworld!");
    expect(execution).resolves.toHaveProperty("exitCode", 0);
  });

  it("compile string expansion", async () => {
    // eslint-disable-next-line no-template-curly-in-string
    const code = 'echo word $SHELL concat_$SHELL infix_${SHELL}_suffix "quoted_$SHELL"';

    const tree = parse(code);
    const result = compile(tree);
    console.debug(result.toString());
    const execution = result();
    const executed = await execution;

    expect(executed.stdout).toEqual("word /bin/bash concat_/bin/bash infix_/bin/bash_suffix quoted_/bin/bash");
    expect(execution).resolves.toHaveProperty("stdout", "word /bin/bash concat_/bin/bash infix_/bin/bash_suffix quoted_/bin/bash");
    expect(execution).resolves.toHaveProperty("exitCode", 0);
  });
});
