import { NextResponse } from "next/server";
import { intParam, jsonError, requireApiHotelAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<any>;
};

function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: rawHotelId, floorId: rawFloorId } = await params;
  const otelId = intParam(rawHotelId, "Otel");
  const katId = intParam(rawFloorId, "Kat");

  const access = await requireApiHotelAccess(otelId);
  if (access.error) return access.error;

  const floor = await prisma.kat.findFirst({
    where: { id: katId, otelId },
    select: { id: true }
  });
  if (!floor) return jsonError("Seçilen kat bu otele ait değil.", 400);

  const today = todayDateOnly();
  const rooms = await prisma.oda.findMany({
    where: { otelId, katId, silindiMi: false },
    orderBy: { odaNo: "asc" },
    include: {
      rezervasyonlar: {
        where: {
          silindiMi: false,
          durum: { not: "IPTAL" },
          girisTarihi: { lte: today },
          cikisTarihi: { gt: today }
        },
        take: 1,
        include: { cari: { select: { ad: true } } }
      }
    }
  });

  const sketch = await prisma.kroki.findFirst({
    where: { otelId, katId },
    select: { id: true }
  });

  return NextResponse.json({
    krokiVarMi: Boolean(sketch),
    odalar: rooms.map((room) => {
      const activeReservation = room.rezervasyonlar[0];
      return {
        id: room.id,
        odaNo: room.odaNo,
        odaTipi: room.odaTipi,
        kapasite: room.kapasite,
        operasyonDurumu: room.operasyonDurumu,
        aciklama: room.aciklama,
        krokiX: room.krokiX,
        krokiY: room.krokiY,
        krokiGenislik: room.krokiGenislik,
        krokiYukseklik: room.krokiYukseklik,
        aktifRezervasyon: activeReservation
          ? {
              cariAd: activeReservation.cari.ad,
              giris: activeReservation.girisTarihi,
              cikis: activeReservation.cikisTarihi,
              kisiSayisi: activeReservation.kisiSayisi
            }
          : null
      };
    })
  });
}
