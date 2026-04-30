import { describe, expect, it } from "vitest";

import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, validateUpload } from "./uploads";

describe("validateUpload", () => {
  it("rejects empty files", () => {
    const result = validateUpload({ size: 0, type: "image/png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing");
  });

  it("rejects files over the limit", () => {
    const result = validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("too_large");
  });

  it("rejects non-image mime types", () => {
    const result = validateUpload({ size: 1024, type: "application/pdf" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("bad_type");
  });

  it("accepts all whitelisted image types", () => {
    for (const type of ALLOWED_MIME_TYPES) {
      expect(validateUpload({ size: 1024, type }).ok).toBe(true);
    }
  });

  it("normalizes mime-type casing", () => {
    expect(validateUpload({ size: 10, type: "IMAGE/PNG" }).ok).toBe(true);
  });

  it("derives extension from mime type", () => {
    const result = validateUpload({ size: 10, type: "image/webp", name: "photo.bin" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.extension).toBe(".webp");
  });
});
