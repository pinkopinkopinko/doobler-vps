import { describe, expect, it } from "vitest";

import {
  buildCompactProfilePhotoSource,
  compactProfilePhotoUrl,
  decodeInlineProfilePhoto,
  isTrustedRemoteProfilePhotoUrl,
} from "@/lib/profile-photo";

describe("compactProfilePhotoUrl", () => {
  it("keeps regular urls untouched", () => {
    expect(compactProfilePhotoUrl("https://example.com/avatar.jpg")).toBe(
      "https://example.com/avatar.jpg",
    );
    expect(compactProfilePhotoUrl("/api/uploads/avatar-1")).toBe("/api/uploads/avatar-1");
  });

  it("keeps tiny inline data urls", () => {
    const tiny = "data:image/png;base64,abcd";
    expect(compactProfilePhotoUrl(tiny)).toBe(tiny);
  });

  it("drops oversized inline data urls from lightweight payloads", () => {
    const huge = `data:image/jpeg;base64,${"a".repeat(10_000)}`;
    expect(compactProfilePhotoUrl(huge)).toBeNull();
  });
});

describe("buildCompactProfilePhotoSource", () => {
  it("keeps compact urls as-is", () => {
    expect(
      buildCompactProfilePhotoSource({
        userId: "user-1",
        photoUrl: "/api/uploads/avatar-1",
      }),
    ).toBe("/api/uploads/avatar-1");
  });

  it("maps oversized inline photos to a lightweight api route", () => {
    const huge = `data:image/jpeg;base64,${"a".repeat(10_000)}`;
    expect(
      buildCompactProfilePhotoSource({
        userId: "user-42",
        photoUrl: huge,
      }),
    ).toBe("/api/profile-photo/user-42");
  });
});

describe("decodeInlineProfilePhoto", () => {
  it("decodes inline data into a buffer and content-type", () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnKXuQAAAAASUVORK5CYII=";

    expect(decodeInlineProfilePhoto(tinyPng)).toMatchObject({
      contentType: "image/png",
    });
  });

  it("returns null for non-inline photos", () => {
    expect(decodeInlineProfilePhoto("/api/uploads/avatar-1")).toBeNull();
  });
});

describe("isTrustedRemoteProfilePhotoUrl", () => {
  it("allows telegram userpic urls including svg", () => {
    expect(
      isTrustedRemoteProfilePhotoUrl(
        "https://t.me/i/userpic/320/fgdbmd2doi89Yzc7D33PWhoHZ4l6K5LuHaPG8PmNRKasFUli4FEafSzgyEFD29HO.svg",
      ),
    ).toBe(true);
  });

  it("rejects unrelated remote urls", () => {
    expect(isTrustedRemoteProfilePhotoUrl("https://example.com/avatar.svg")).toBe(false);
  });
});
