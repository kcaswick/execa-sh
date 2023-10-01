import { describe, expect, it } from "vitest";

import { isolateScope } from "../isolateScope.js";

describe("isolateScope", () => {
  it("should create a new function with a new scope that only has access to the provided code", () => {
    const code = `
      const x = 1;
      const y = 2;
      return x + y;
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe(3);
  });

  it("should not have access to global variables", () => {
    const code = `
      return typeof global;
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe("undefined");
  });

  it("should not have access to the eval function", () => {
    const code = `
      return typeof eval;
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe("undefined");
  });

  it("should not have access to the Function constructor", () => {
    const code = `
      return typeof Function;
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe("undefined");
  });

  it("should not have access to the function prototype", () => {
    const code = `
      return typeof (()=>false).__proto__.constructor;
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe("undefined");
  });

  it("should not have indirect access to the Function constructor", () => {
    const code = `
      return typeof (()=>false).__proto__.constructor?.("return Function")();
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe("undefined");
  });

  it("should escape inner strings", () => {
    const code = `
      const x = "hello";
      return x;
    `;
    const isolatedFunction = isolateScope(code);
    expect(isolatedFunction()).toBe("hello");
  });
});
