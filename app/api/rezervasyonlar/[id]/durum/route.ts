import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  islem: z.enum(["ONAYLA", "GIRIS_YAP", "CIKIS_YAP", "IPTAL"])
});

type RouteContext = {
  params: Promise<any>;
};

const transition = {
  ONAYLA: { from: ["BEKLEMEDE"], to: "ONAYLANDI", room: "REZERVE", required: "TAM" },
  GIRIS_YAP: { from: ["ONAYLANDI"], to: "GIRIS_YAPILDI", room: "DOLU", required: "EKLE" },
  CIKIS_YAP: { from: ["GIRIS_YAPILDI"], to: "CIKIS_YAPILDI", room: "BOS", required: "EKLE" },
  IPTAL: { from: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"], to: "IPTAL", room: "BOS", required: "TAM" }
} as const;

export async function PATCH(request: Request, { params }: RouteContext) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Rezervasyon durum işlemi geçerli değil.", 400);

  const { id: rawId } = await params;
  const id = intParam(rawId, "Rezervasyon");
  const rezervasyon = await prisma.rezervasyon.findFirst({
    where: { id, silindiMi: false },
    include: { oda: { select: { odaNo: true } }, cari: { select: { ad: true } } }
  });
  if (!rezervasyon) return jsonError("Rezervasyon bulunamadı.", 404);

  const rule = transition[parsed.data.islem];
  const permission = await requireApiHotelPermission(
    rezervasyon.otelId,
    "rezervasyon",
    parsed.data.islem === "IPTAL" ? "GORUNTULE" : rule.required
  );
  if (permission.error || !permission.session) return permission.error;

  if (!(rule.from as readonly string[]).includes(rezervasyon.durum)) {
    return jsonError("Bu rezervasyon için seçilen durum işlemi uygulanamaz.", 400);
  }

  if (parsed.data.islem === "IPTAL" && permission.session.rol === "PERSONEL") {
    const talep = await prisma.onayTalebi.create({
      data: {
        talepEdenId: permission.session.id,
        otelId: rezervasyon.otelId,
        tur: "REZERVASYON_SILME",
        hedefTablo: "Rezervasyon",
        hedefKayitId: rezervasyon.id,
        istenenDegisiklik: { durum: "IPTAL" }
      }
    });
    return NextResponse.json({ onayTalebi: talep, message: "İptal talebi yönetici onayına gönderildi." }, { status: 202 });
  }

  const directPermission = await requireApiHotelPermission(rezervasyon.otelId, "rezervasyon", rule.required);
  if (directPermission.error || !directPermission.session) return directPermission.error;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.rezervasyon.update({
      where: { id: rezervasyon.id },
      data: { durum: rule.to },
      include: { oda: { select: { odaNo: true } }, cari: { select: { ad: true } }, otel: { select: { ad: true } } }
    });

    let nextRoomStatus = rule.room;
    if (parsed.data.islem === "IPTAL") {
      await tx.cariHareket.updateMany({
        where: { rezervasyonId: rezervasyon.id, tur: "KONAKLAMA_BORC", silindiMi: false },
        data: { silindiMi: true, silinmeTarihi: new Date() }
      });

      const otherActive = await tx.rezervasyon.count({
        where: {
          id: { not: rezervasyon.id },
          odaId: rezervasyon.odaId,
          silindiMi: false,
          durum: { in: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"] }
        }
      });
      if (otherActive > 0) nextRoomStatus = rezervasyon.odaId ? "REZERVE" : "BOS";
    }

    await tx.oda.update({
      where: { id: rezervasyon.odaId },
      data: { operasyonDurumu: nextRoomStatus }
    });

    await tx.islemLogu.create({
      data: {
        kullaniciId: directPermission.session.id,
        otelId: rezervasyon.otelId,
        islemTuru: "REZERVASYON_DURUM_GUNCELLEME",
        tablo: "Rezervasyon",
        kayitId: rezervasyon.id,
        oncekiDeger: { durum: rezervasyon.durum },
        yeniDeger: { durum: rule.to },
        aciklama: `Rezervasyon durumu güncellendi: Oda ${rezervasyon.oda.odaNo}, ${rezervasyon.cari.ad}`
      }
    });

    return result;
  });

  return NextResponse.json({ rezervasyon: updated });
}
