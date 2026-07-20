import { z } from "zod";
import { intParam, jsonError, requireApiHotelPermission, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  kararAciklamasi: z.string().optional().nullable()
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol === "PERSONEL") return jsonError("Onay vermek icin yonetici yetkisi gerekir.", 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Onay aciklamasini kontrol edin.", 400);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Onay talebi");
  const talep = await prisma.onayTalebi.findUnique({
    where: { id },
    include: { otel: { select: { ad: true } } }
  });
  if (!talep) return jsonError("Onay talebi bulunamadi.", 404);
  if (talep.durum !== "BEKLIYOR") return jsonError("Bu talep daha once karara baglanmis.", 400);
  if (talep.tur !== "REZERVASYON_SILME" || talep.hedefTablo !== "Rezervasyon") {
    return jsonError("Bu onay turu henuz aktif degil.", 400);
  }

  const permission = await requireApiHotelPermission(talep.otelId, "otel", "GORUNTULE");
  if (permission.error) return permission.error;

  const rezervasyon = await prisma.rezervasyon.findFirst({
    where: { id: talep.hedefKayitId, otelId: talep.otelId, silindiMi: false },
    include: { oda: { select: { odaNo: true } }, cari: { select: { ad: true } } }
  });
  if (!rezervasyon) return jsonError("Iptal edilecek rezervasyon bulunamadi.", 404);

  const result = await prisma.$transaction(async (tx) => {
    const updatedReservation = await tx.rezervasyon.update({
      where: { id: rezervasyon.id },
      data: { durum: "IPTAL" }
    });
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
    await tx.oda.update({
      where: { id: rezervasyon.odaId },
      data: { operasyonDurumu: otherActive > 0 ? "REZERVE" : "BOS" }
    });
    const karar = await tx.onayTalebi.update({
      where: { id: talep.id },
      data: {
        durum: "ONAYLANDI",
        kararVerenId: session.id,
        kararTarihi: new Date(),
        kararAciklamasi: parsed.data.kararAciklamasi || null
      }
    });
    await tx.islemLogu.create({
      data: {
        kullaniciId: session.id,
        otelId: talep.otelId,
        islemTuru: "ONAY_TALEBI_ONAYLANDI",
        tablo: "OnayTalebi",
        kayitId: talep.id,
        oncekiDeger: { durum: talep.durum },
        yeniDeger: { durum: "ONAYLANDI", rezervasyonDurum: "IPTAL" },
        aciklama: `Rezervasyon iptal talebi onaylandi: Oda ${rezervasyon.oda.odaNo}, ${rezervasyon.cari.ad}`
      }
    });
    return { karar, rezervasyon: updatedReservation };
  });

  return Response.json({ ...result, message: "Rezervasyon iptal talebi onaylandi." });
}
