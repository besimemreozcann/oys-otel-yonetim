import { describe, expect, it } from "vitest";
import { parseJsonBody } from "../lib/api";

describe("api yardimcilari", () => {
  it("bozuk JSON govdesini 400 olarak doner", async () => {
    const result = await parseJsonBody(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ bozuk"
      })
    );

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
    expect(await result.error?.json()).toEqual({ message: "Geçersiz istek gövdesi." });
  });
});
