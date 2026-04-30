import { describe, expect, it } from "vitest";

import { buildParticipantKey } from "./participant-key";

describe("buildParticipantKey", () => {
  it("is order-independent", () => {
    expect(buildParticipantKey("a", "b")).toBe(buildParticipantKey("b", "a"));
  });

  it("separates ids deterministically", () => {
    expect(buildParticipantKey("alice", "bob")).toBe("alice__bob");
  });

  it("rejects self conversations", () => {
    expect(() => buildParticipantKey("a", "a")).toThrow();
  });

  it("rejects empty ids", () => {
    expect(() => buildParticipantKey("", "b")).toThrow();
    expect(() => buildParticipantKey("a", "")).toThrow();
  });
});
