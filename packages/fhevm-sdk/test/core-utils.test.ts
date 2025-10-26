import { describe, it, expect } from "vitest";
import { toHex, getEncryptionMethod, buildParamsFromAbi } from "../src/core/encryption";

describe("core encryption utils", () => {
  it("toHex converts Uint8Array", () => {
    const u8 = new Uint8Array([1, 2, 3]);
    const hex = toHex(u8);
    expect(hex.startsWith("0x")).toBe(true);
  });

  it("getEncryptionMethod has defaults", () => {
    expect(getEncryptionMethod("unknown" as any)).toBe("add64");
  });

  it("buildParamsFromAbi maps enc to function inputs", () => {
    const abi = [
      {
        type: "function",
        name: "foo",
        inputs: [{ name: "a", type: "bytes" }, { name: "b", type: "bytes" }],
      },
    ];
    const params = buildParamsFromAbi({ handles: [new Uint8Array([1])], inputProof: new Uint8Array([2]) }, abi as any, "foo");
    expect(params.length).toBe(2);
  });
});


