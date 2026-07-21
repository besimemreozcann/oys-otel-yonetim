import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  requireApiHotelAccess: vi.fn(),
  prisma: {
    kat: {
      findFirst: vi.fn()
    },
    oda: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    kroki: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/api", () => ({
  intParam: (value: string | null, name: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} gecersiz.`);
    return parsed;
  },
  jsonError: (message: string, status = 400) => Response.json({ message }, { status }),
  parseJsonBody: async (request: Request) => ({ data: await request.json(), error: null }),
  requireApiHotelAccess: apiMocks.requireApiHotelAccess
}));

vi.mock("@/lib/prisma", () => ({
  prisma: apiMocks.prisma
}));

import { PUT as updateRoomPositions } from "../app/api/hotels/[id]/floors/[floorId]/room-positions/route";
import { GET as getFloorRooms } from "../app/api/hotels/[id]/floors/[floorId]/rooms/route";
import { PATCH as updateRoomStatus } from "../app/api/rooms/[roomId]/status/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/test", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  apiMocks.requireApiHotelAccess.mockReset();
  apiMocks.prisma.kat.findFirst.mockReset();
  apiMocks.prisma.oda.count.mockReset();
  apiMocks.prisma.oda.findFirst.mockReset();
  apiMocks.prisma.oda.findMany.mockReset();
  apiMocks.prisma.oda.update.mockReset();
  apiMocks.prisma.kroki.findFirst.mockReset();
  apiMocks.prisma.$transaction.mockReset();
});

describe("kroki API kurallari", () => {
  it("yetkisiz otelin kroki odalari 403 doner", async () => {
    apiMocks.requireApiHotelAccess.mockResolvedValue({
      error: Response.json({ message: "forbidden" }, { status: 403 }),
      session: null
    });

    const response = await getFloorRooms(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: "2", floorId: "1" })
    });

    expect(response.status).toBe(403);
    expect(apiMocks.prisma.kat.findFirst).not.toHaveBeenCalled();
  });

  it("yetkili personel otelindeki odalari gorebilir", async () => {
    apiMocks.requireApiHotelAccess.mockResolvedValue({
      error: null,
      session: { id: 5, rol: "PERSONEL" }
    });
    apiMocks.prisma.kat.findFirst.mockResolvedValue({ id: 1 });
    apiMocks.prisma.oda.findMany.mockResolvedValue([
      {
        id: 10,
        odaNo: "101",
        odaTipi: "Standart",
        kapasite: 2,
        operasyonDurumu: "BOS",
        aciklama: null,
        krokiX: 20,
        krokiY: 30,
        krokiGenislik: 100,
        krokiYukseklik: 80,
        rezervasyonlar: []
      }
    ]);
    apiMocks.prisma.kroki.findFirst.mockResolvedValue({ id: 1 });

    const response = await getFloorRooms(new Request("http://localhost/test"), {
      params: Promise.resolve({ id: "1", floorId: "1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.krokiVarMi).toBe(true);
    expect(body.odalar).toHaveLength(1);
    expect(body.odalar[0].odaNo).toBe("101");
  });

  it("batch konum guncelleme baska kata ait oda icerirse 400 doner", async () => {
    apiMocks.requireApiHotelAccess.mockResolvedValue({
      error: null,
      session: { id: 1, rol: "SUPER_ADMIN" }
    });
    apiMocks.prisma.kat.findFirst.mockResolvedValue({
      id: 1,
      ad: "1. Kat",
      otel: { ad: "OYS Otel" }
    });
    apiMocks.prisma.oda.count.mockResolvedValue(1);

    const response = await updateRoomPositions(
      jsonRequest({
        odalar: [
          { id: 10, krokiX: 20, krokiY: 30, krokiGenislik: 100, krokiYukseklik: 80 },
          { id: 99, krokiX: 40, krokiY: 50, krokiGenislik: 100, krokiYukseklik: 80 }
        ]
      }),
      { params: Promise.resolve({ id: "1", floorId: "1" }) }
    );

    expect(response.status).toBe(400);
    expect(apiMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("oda durum guncellemesi islem logu olusturur", async () => {
    apiMocks.prisma.oda.findFirst.mockResolvedValue({
      id: 10,
      otelId: 1,
      odaNo: "101",
      operasyonDurumu: "BOS"
    });
    apiMocks.requireApiHotelAccess.mockResolvedValue({
      error: null,
      session: { id: 7, rol: "PERSONEL" }
    });
    const tx = {
      oda: {
        update: vi.fn().mockResolvedValue({
          id: 10,
          odaNo: "101",
          odaTipi: "Standart",
          kapasite: 2,
          aciklama: null,
          operasyonDurumu: "BAKIM",
          krokiX: 20,
          krokiY: 30,
          krokiGenislik: 100,
          krokiYukseklik: 80
        })
      },
      islemLogu: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    apiMocks.prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await updateRoomStatus(jsonRequest({ operasyonDurumu: "BAKIM" }), {
      params: Promise.resolve({ roomId: "10" })
    });

    expect(response.status).toBe(200);
    expect(tx.islemLogu.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kullaniciId: 7,
        otelId: 1,
        tablo: "Oda",
        kayitId: 10,
        oncekiDeger: { operasyonDurumu: "BOS" },
        yeniDeger: { operasyonDurumu: "BAKIM" }
      })
    });
  });
});
