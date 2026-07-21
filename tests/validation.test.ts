import { describe, expect, it } from "vitest";
import { validateTutarCents } from "../lib/validation";

describe("ortak validasyon yardimcilari", () => {
  it("negatif ve sifir tutarlari reddeder", () => {
    expect(validateTutarCents(-100, "Tahsilat tutarı")).toBe("Tahsilat tutarı sıfırdan büyük olmalıdır.");
    expect(validateTutarCents(0, "Tutar")).toBe("Tutar sıfırdan büyük olmalıdır.");
  });

  it("asiri buyuk tutarlari reddeder", () => {
    expect(validateTutarCents(100_000_000_000, "Tutar")).toBe("Tutar çok büyük.");
  });

  it("makul pozitif tutarlari kabul eder", () => {
    expect(validateTutarCents(10_000, "Tutar")).toBeNull();
  });
});
