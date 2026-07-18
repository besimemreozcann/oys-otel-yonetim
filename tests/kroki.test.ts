import { describe, expect, it } from "vitest";
import { clampRoomPosition, hasDuplicateRoomIds, hasHotelAccess } from "../lib/kroki";

describe("kroki yetki ve konum kuralları", () => {
  it("SUPER_ADMIN otel yetki satırı olmadan krokiye erişir", () => {
    expect(hasHotelAccess({ id: 1, rol: "SUPER_ADMIN" }, [], 999)).toBe(true);
  });

  it("PERSONEL sadece yetki satırı olan otelin krokisine erişir", () => {
    const permissions = [
      {
        otelId: 1,
        rezervasyonYetkisi: "EKLE" as const,
        cariYetkisi: "YOK" as const,
        finansYetkisi: "YOK" as const,
        raporYetkisi: "GORUNTULE" as const
      }
    ];

    expect(hasHotelAccess({ id: 3, rol: "PERSONEL" }, permissions, 1)).toBe(true);
    expect(hasHotelAccess({ id: 3, rol: "PERSONEL" }, permissions, 2)).toBe(false);
  });

  it("oda konumunu canvas ve boyut sınırlarına çeker", () => {
    const clamped = clampRoomPosition({
      id: 1,
      krokiX: 2000,
      krokiY: -50,
      krokiGenislik: 500,
      krokiYukseklik: 10
    });

    expect(clamped).toEqual({
      id: 1,
      krokiX: 1000,
      krokiY: 0,
      krokiGenislik: 200,
      krokiYukseklik: 50
    });
  });

  it("null konum gönderilen odayı yerleştirilmemiş sayar", () => {
    expect(
      clampRoomPosition({
        id: 1,
        krokiX: null,
        krokiY: 10,
        krokiGenislik: 100,
        krokiYukseklik: 80
      })
    ).toEqual({
      id: 1,
      krokiX: null,
      krokiY: null,
      krokiGenislik: null,
      krokiYukseklik: null
    });
  });

  it("batch kayıtta tekrar eden oda id değerini yakalar", () => {
    expect(
      hasDuplicateRoomIds([
        { id: 1, krokiX: 10, krokiY: 10, krokiGenislik: 100, krokiYukseklik: 80 },
        { id: 1, krokiX: 20, krokiY: 20, krokiGenislik: 100, krokiYukseklik: 80 }
      ])
    ).toBe(true);
  });
});
