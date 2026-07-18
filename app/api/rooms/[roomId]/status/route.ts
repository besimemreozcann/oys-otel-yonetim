import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, requireApiHotelAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  operasyonDurumu: z.enum(["BOS", "DOLU", "REZERVE", "BAKIM", "TEMIZLIK"])
});

type RouteContext = {
  params: Promise<any>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { roomId: rawRoomId } = await params;
  const roomId = intParam(rawRoomId, "Oda");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Oda durumu geçerli değil.", 400);

  const room = await prisma.oda.findFirst({
    where: { id: roomId, silindiMi: false },
    select: { id: true, otelId: true, odaNo: true, operasyonDurumu: true }
  });
  if (!room) return jsonError("Oda bulunamadı.", 404);

  const access = await requireApiHotelAccess(room.otelId);
  if (access.error || !access.session) return access.error;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.oda.update({
      where: { id: roomId },
      data: { operasyonDurumu: parsed.data.operasyonDurumu },
      select: {
        id: true,
        odaNo: true,
        odaTipi: true,
        kapasite: true,
        aciklama: true,
        operasyonDurumu: true,
        krokiX: true,
        krokiY: true,
        krokiGenislik: true,
        krokiYukseklik: true
      }
    });

    await tx.islemLogu.create({
      data: {
        kullaniciId: access.session.id,
        otelId: room.otelId,
        islemTuru: "ODA_DURUM_GUNCELLEME",
        tablo: "Oda",
        kayitId: room.id,
        oncekiDeger: { operasyonDurumu: room.operasyonDurumu },
        yeniDeger: { operasyonDurumu: parsed.data.operasyonDurumu },
        aciklama: `Oda ${room.odaNo} durumu güncellendi.`
      }
    });

    return result;
  });

  return NextResponse.json({ oda: updated });
}
