import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PAYLOAD_CREDIT,
  checksum,
  decryptSource,
  deriveWrapKey,
  encryptSource,
  grokMentions,
  newUuid,
  parseKeyChunk,
  unwrapWithKey,
  wrapPublishedSource,
} from "./protect.server.ts";

describe("protect wrap", () => {
  it("roundtrips source through the same xor the loader uses", () => {
    const source = `local x = "LoadstringWelcome"\nreturn x\n`;
    const runtimeId = newUuid();
    const wrapSeed = newUuid();
    const versionId = "ver_test";
    const wrapped = wrapPublishedSource({
      source,
      origin: "https://example.test",
      runtimeId,
      wrapSeed,
      versionId,
    });
    const key = deriveWrapKey(wrapSeed, versionId);
    const decoded = decryptSource(Buffer.from(wrapped.cipherHex, "hex"), key);
    assert.equal(decoded.toString("utf8"), source);
    assert.equal(checksum(decoded), wrapped.checksum);
    assert.equal(unwrapWithKey(wrapped.cipherHex, wrapped.keyChunk), source);
    assert.equal(parseKeyChunk(wrapped.keyChunk).equals(key), true);
  });

  it("puts the credit header and a uuid, and no grok token in the payload", () => {
    const runtimeId = "550e8400-e29b-41d4-a716-446655440000";
    const wrapped = wrapPublishedSource({
      source: `-- private\nprint("secret-token-xyz")\n`,
      origin: "https://host.example",
      runtimeId,
      wrapSeed: newUuid(),
      versionId: "ver_abc",
    });
    assert.equal(wrapped.lua.startsWith(PAYLOAD_CREDIT + "\n"), true);
    assert.equal(grokMentions(wrapped.lua), 0);
    assert.match(wrapped.lua, /550e8400-e29b-41d4-a716-446655440000/);
    assert.equal(wrapped.lua.includes("secret-token-xyz"), false);
    assert.equal(wrapped.lua.includes("print("), false);
    assert.equal(wrapped.lua.includes("https://host.example"), false);
    assert.equal(wrapped.lua.includes("prj_"), false);
  });

  it("does not unwrap without the matching key", () => {
    const wrapped = wrapPublishedSource({
      source: "print(1)\n",
      origin: "https://h",
      runtimeId: newUuid(),
      wrapSeed: newUuid(),
      versionId: "ver_1",
    });
    const other = wrapPublishedSource({
      source: "print(2)\n",
      origin: "https://h",
      runtimeId: newUuid(),
      wrapSeed: newUuid(),
      versionId: "ver_2",
    });
    const decoded = unwrapWithKey(wrapped.cipherHex, other.keyChunk);
    assert.notEqual(decoded, "print(1)\n");
  });
});
