import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAuthSyncMessage } from "./auth-sync";

describe("auth-sync message format", () => {
  it("accepts access / clear / refreshing envelopes", () => {
    assert.equal(parseAuthSyncMessage({ v: 1, type: "access", token: "abc", at: 1 })?.type, "access");
    assert.equal(parseAuthSyncMessage({ v: 1, type: "clear", at: 1 })?.type, "clear");
    assert.equal(parseAuthSyncMessage({ v: 1, type: "refreshing", at: 1 })?.type, "refreshing");
  });

  it("rejects invalid payloads", () => {
    assert.equal(parseAuthSyncMessage(null), null);
    assert.equal(parseAuthSyncMessage({ v: 2, type: "clear", at: 1 }), null);
    assert.equal(parseAuthSyncMessage({ v: 1, type: "access", token: "", at: 1 }), null);
    assert.equal(parseAuthSyncMessage({ v: 1, type: "access", at: 1 }), null);
  });
});
