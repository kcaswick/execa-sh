import { describe, expect, it } from "vitest";

import { execaSh } from "../index.js";

describe("execaSh", () => {
  it("has a test", () => {
    const helloString = "Hello, world!";
    const result = execaSh`echo ${helloString}`;
    expect(result).resolves.toHaveProperty("stdout", helloString);
  });
});
