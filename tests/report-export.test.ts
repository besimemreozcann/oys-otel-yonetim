import { describe, expect, it } from "vitest";
import { reportRequestSchema, reportToTable, sanitizeExcelRow } from "../lib/report-export";

describe("Faz 5 rapor export yardimcilari", () => {
  it("rapor filtrelerini sayisal alanlara donusturur", () => {
    const parsed = reportRequestSchema.parse({
      raporTuru: "gelir-gider",
      otelId: "1",
      hesapId: "2",
      baslangic: "2026-07-01",
      bitis: "2026-07-20"
    });

    expect(parsed.otelId).toBe(1);
    expect(parsed.hesapId).toBe(2);
  });

  it("cari ekstre verisini export tablosuna cevirir", () => {
    const table = reportToTable("cari-ekstre", {
      title: "Cari Ekstre",
      cariName: "Test Cari",
      rows: [
        {
          tarih: "2026-07-20T10:00:00.000Z",
          otelOda: "Otel / 101",
          kisi: 2,
          islem: "Tahsilat",
          borc: "0.00",
          alacak: "1500.00",
          bakiye: "-1500.00"
        }
      ],
      summary: { toplamBorc: "0.00", toplamAlacak: "1500.00", bakiye: "-1500.00" }
    });

    expect(table.title).toContain("Test Cari");
    expect(table.headers).toContain("Bakiye");
    expect(table.rows[0][3]).toBe("Tahsilat");
    expect(table.summary?.join(" ")).toContain("Toplam Alacak");
  });

  it("ters rapor tarih araligini reddeder", () => {
    const parsed = reportRequestSchema.safeParse({
      raporTuru: "gelir-gider",
      otelId: "1",
      baslangic: "2026-07-20",
      bitis: "2026-07-01"
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Bitiş tarihi başlangıç tarihinden önce olamaz.");
    }
  });

  it("bir yildan uzun rapor tarih araligini reddeder", () => {
    const parsed = reportRequestSchema.safeParse({
      raporTuru: "gelir-gider",
      otelId: "1",
      baslangic: "2025-01-01",
      bitis: "2026-01-02"
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("en fazla 1 yıl");
    }
  });

  it("excel formul olarak yorumlanabilecek metinleri guvenli hale getirir", () => {
    expect(sanitizeExcelRow(["=1+1", "+90", "-komut", "@alan", "normal", 12])).toEqual([
      "'=1+1",
      "'+90",
      "'-komut",
      "'@alan",
      "normal",
      12
    ]);
  });
});
