import { z } from "zod";
import { intParam, jsonError, requireApiHotelPermission, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  kararAciklamasi: z.string().trim().min(2)
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol === "PERSONEL") return jsonError("Onay talebini reddetmek icin yonetici yetkisi gerekir.", 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Red aciklamasi zorunludur.", 400);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Onay talebi");
  const talep = await prisma.onayTalebi.findUnique({ where: { id } });
  if (!talep) return jsonError("Onay talebi bulunamadi.", 404);
  if (talep.durum !== "BEKLIYOR") return jsonError("Bu talep daha once karara baglanmis.", 400);

  const permission = await requireApiHotelPermission(talep.otelId, "otel", "GORUNTULE");
  if (permission.error) return permission.error;

  const karar = await prisma.$transaction(async (tx) => {
    const updated = await tx.onayTalebi.update({
      where: { id: talep.id },
      data: {
        durum: "REDDEDILDI",
        kararVerenId: session.id,
        kararTarihi: new Date(),
        kararAciklamasi: parsed.data.kararAciklamasi
      }
    });
    await tx.islemLogu.create({
      data: {
        kullaniciId: session.id,
        otelId: talep.otelId,
        islemTuru: "ONAY_TALEBI_REDDEDILDI",
        tablo: "OnayTalebi",
        kayitId: talep.id,
        oncekiDeger: { durum: talep.durum },
        yeniDeger: { durum: "REDDEDILDI", kararAciklamasi: parsed.data.kararAciklamasi },
        aciklama: "Onay talebi reddedildi."
      }
    });
    return updated;
  });

  return Response.json({ karar, message: "Onay talebi reddedildi." });
}
