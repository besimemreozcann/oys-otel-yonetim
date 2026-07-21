import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  requireApiSession: vi.fn(),
  requireApiHotelPermission: vi.fn(),
  prisma: {
    kullanici: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn()
    },
    onayTalebi: {
      findUnique: vi.fn()
    },
    rezervasyon: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/api", () => ({
  intParam: (value: string | null, name: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} geçersiz.`);
    return parsed;
  },
  jsonError: (message: string, status = 400) => Response.json({ message }, { status }),
  parseJsonBody: async (request: Request) => ({ data: await request.json(), error: null }),
  prismaErrorResponse: () => null,
  requireApiSession: apiMocks.requireApiSession,
  requireApiHotelPermission: apiMocks.requireApiHotelPermission
}));

vi.mock("@/lib/prisma", () => ({
  prisma: apiMocks.prisma
}));

import { PATCH as approveRequest } from "../app/api/onay-kuyrugu/[id]/onayla/route";
import { PATCH as updateUser } from "../app/api/users/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/test", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  apiMocks.requireApiSession.mockReset();
  apiMocks.requireApiHotelPermission.mockReset();
  apiMocks.prisma.kullanici.findFirst.mockReset();
  apiMocks.prisma.kullanici.count.mockReset();
  apiMocks.prisma.kullanici.update.mockReset();
  apiMocks.prisma.onayTalebi.findUnique.mockReset();
  apiMocks.prisma.rezervasyon.findFirst.mockReset();
  apiMocks.prisma.$transaction.mockReset();
});

describe("Düzeltme Paketi 1 güvenlik kuralları", () => {
  it("son aktif SUPER_ADMIN pasifleştirilemez", async () => {
    apiMocks.requireApiSession.mockResolvedValue({
      error: null,
      session: { id: 1, rol: "SUPER_ADMIN" }
    });
    const tx = {
      kullanici: {
        findUnique: vi.fn().mockResolvedValue({ rol: "SUPER_ADMIN", aktifMi: true }),
        update: vi.fn().mockResolvedValue({ id: 1, rol: "SUPER_ADMIN", aktifMi: false }),
        count: vi.fn().mockResolvedValue(0)
      }
    };
    apiMocks.prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await updateUser(jsonRequest({ aktifMi: false }), {
      params: Promise.resolve({ id: "1" })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Sistemdeki son aktif süper yöneticiyi pasifleştiremez veya silemezsiniz.");
    expect(tx.kullanici.count).toHaveBeenCalledWith({ where: { rol: "SUPER_ADMIN", aktifMi: true } });
  });

  it("başka aktif SUPER_ADMIN varsa pasifleştirme yapılabilir", async () => {
    apiMocks.requireApiSession.mockResolvedValue({
      error: null,
      session: { id: 1, rol: "SUPER_ADMIN" }
    });
    const updatedUser = {
      id: 1,
      adSoyad: "Admin",
      kullaniciAdi: "admin",
      rol: "SUPER_ADMIN",
      aktifMi: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      otelYetkileri: []
    };
    const tx = {
      kullanici: {
        findUnique: vi.fn().mockResolvedValue({ rol: "SUPER_ADMIN", aktifMi: true }),
        update: vi.fn().mockResolvedValue(updatedUser),
        count: vi.fn().mockResolvedValue(1)
      }
    };
    apiMocks.prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await updateUser(jsonRequest({ aktifMi: false }), {
      params: Promise.resolve({ id: "1" })
    });

    expect(response.status).toBe(200);
    expect(tx.kullanici.update).toHaveBeenCalled();
  });

  it("daha önce işlenen onay talebinde 409 döner ve rezervasyonu değiştirmez", async () => {
    apiMocks.requireApiSession.mockResolvedValue({
      error: null,
      session: { id: 2, rol: "ADMIN" }
    });
    apiMocks.prisma.onayTalebi.findUnique.mockResolvedValue({
      id: 5,
      durum: "ONAYLANDI",
      tur: "REZERVASYON_SILME",
      hedefTablo: "Rezervasyon",
      hedefKayitId: 10,
      otelId: 1
    });
    apiMocks.requireApiHotelPermission.mockResolvedValue({ error: null, session: { id: 2, rol: "ADMIN" } });
    apiMocks.prisma.rezervasyon.findFirst.mockResolvedValue({
      id: 10,
      odaId: 20,
      oda: { odaNo: "101" },
      cari: { ad: "Test Cari" }
    });
    const tx = {
      onayTalebi: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      rezervasyon: {
        update: vi.fn()
      },
      cariHareket: {
        updateMany: vi.fn()
      },
      oda: {
        update: vi.fn()
      },
      islemLogu: {
        create: vi.fn()
      }
    };
    apiMocks.prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await approveRequest(jsonRequest({ kararAciklamasi: "Tamam" }), {
      params: Promise.resolve({ id: "5" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("Bu talep zaten işleme alınmış.");
    expect(tx.rezervasyon.update).not.toHaveBeenCalled();
  });
});
