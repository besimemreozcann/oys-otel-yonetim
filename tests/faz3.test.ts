import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  calculateBalanceCents,
  centsToDecimalString,
  decimalToCents,
  isReservationConflictError,
  nightCount
} from "../lib/faz3";

describe("Faz 3 rezervasyon ve cari yardimcilari", () => {
  it("gece sayisini tarih farkindan hesaplar", () => {
    expect(nightCount("2026-08-01", "2026-08-05")).toBe(4);
    expect(nightCount("2026-08-01", "2026-08-01")).toBe(0);
  });

  it("para degerlerini kurus bazli hesaplar", () => {
    expect(decimalToCents("1250.75")).toBe(125075);
    expect(centsToDecimalString(125075)).toBe("1250.75");
  });

  it("cari bakiyeyi hareketlerden hesaplar", () => {
    expect(
      calculateBalanceCents([
        { borc: "5000.00", alacak: "0.00" },
        { borc: "8000.50", alacak: "1000.25" }
      ])
    ).toBe(1200025);
  });

  it("PostgreSQL exclusion constraint hatasini rezervasyon cakismasi sayar", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Raw query failed", {
      code: "P2010",
      clientVersion: "test",
      meta: { cause: "ERROR: 23P01 rezervasyon_cakisma_engeli" }
    });

    expect(isReservationConflictError(error)).toBe(true);
  });
});
