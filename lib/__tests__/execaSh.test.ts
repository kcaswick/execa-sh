import assert from "assert";
import { execaSh } from "../index";

describe("execaSh", () => {
  it("has a test", () => {
    const helloString = "Hello, world!";
    const result = execaSh`echo ${helloString}`;
    expect(result).resolves.toEqual(helloString);
  });
});
