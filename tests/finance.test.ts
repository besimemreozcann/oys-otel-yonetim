import { describe, expect, it } from "vitest";
import { calculateAccountBalanceCents, isValidAccountForPaymentMethod } from "../lib/finance";

describe("Faz 4 finans yardimcilari", () => {
  it("hesap bakiyesini hareket turlerine gore hesaplar", () => {
    expect(
      calculateAccountBalanceCents([
        { tur: "TAHSILAT", tutar: "5000.00" },
        { tur: "GIDER", tutar: "750.50" },
        { tur: "VIRMAN_GIRIS", tutar: "1000.00" },
        { tur: "VIRMAN_CIKIS", tutar: "250.00" }
      ])
    ).toBe(499950);
  });

  it("odeme yontemine gore hesap turunu dogrular", () => {
    expect(isValidAccountForPaymentMethod("NAKIT", "NAKIT_KASA")).toBe(true);
    expect(isValidAccountForPaymentMethod("NAKIT", "BANKA")).toBe(false);
    expect(isValidAccountForPaymentMethod("HAVALE", "BANKA")).toBe(true);
    expect(isValidAccountForPaymentMethod("KART", "NAKIT_KASA")).toBe(false);
  });
});
