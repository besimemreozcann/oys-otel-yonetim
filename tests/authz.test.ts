import { describe, expect, it } from "vitest";
import { hasHotelPermission } from "../lib/authz";

const personel = { id: 10, rol: "PERSONEL" as const };
const superAdmin = { id: 1, rol: "SUPER_ADMIN" as const };

describe("yetki katmanı", () => {
  it("yetkisiz kullanıcı başka otelin verisine API seviyesinde erişemez", () => {
    const decision = hasHotelPermission(
      personel,
      [
        {
          otelId: 1,
          rezervasyonYetkisi: "GORUNTULE",
          cariYetkisi: "YOK",
          finansYetkisi: "YOK",
          raporYetkisi: "YOK"
        }
      ],
      2,
      "rezervasyon",
      "GORUNTULE"
    );

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
    expect(decision.message).toContain("Bu otele erişim yetkiniz yok");
  });

  it("PERSONEL finans yetkisi yokken finans endpoint mantığından 403 alır", () => {
    const decision = hasHotelPermission(
      personel,
      [
        {
          otelId: 1,
          rezervasyonYetkisi: "EKLE",
          cariYetkisi: "GORUNTULE",
          finansYetkisi: "YOK",
          raporYetkisi: "GORUNTULE"
        }
      ],
      1,
      "finans",
      "GORUNTULE"
    );

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(403);
  });

  it("SUPER_ADMIN tüm otellere erişir", () => {
    const decision = hasHotelPermission(superAdmin, [], 999, "finans", "TAM");

    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe(200);
  });
});
