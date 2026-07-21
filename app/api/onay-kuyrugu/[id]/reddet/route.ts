import { z } from "zod";
import { intParam, jsonError, parseJsonBody, requireApiHotelPermission, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  kararAciklamasi: z.string().trim().min(2)
});

const ALREADY_PROCESSED_MESSAGE = "Bu talep zaten işleme alınmış.";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol === "PERSONEL") return jsonError("Onay talebini reddetmek icin yonetici yetkisi gerekir.", 403);

  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Red aciklamasi zorunludur.", 400);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Onay talebi");
  const talep = await prisma.onayTalebi.findUnique({ where: { id } });
  if (!talep) return jsonError("Onay talebi bulunamadi.", 404);

  const permission = await requireApiHotelPermission(talep.otelId, "otel", "GORUNTULE");
  if (permission.error) return permission.error;

  const karar = await prisma.$transaction(async (tx) => {
    const guarded = await tx.onayTalebi.updateMany({
      where: { id: talep.id, durum: "BEKLIYOR" },
      data: {
        durum: "REDDEDILDI",
        kararVerenId: session.id,
        kararTarihi: new Date(),
        kararAciklamasi: parsed.data.kararAciklamasi
      }
    });
    if (guarded.count === 0) {
      return { conflict: true };
    }

    const updated = await tx.onayTalebi.findUnique({
      where: { id: talep.id },
      include: { kararVeren: { select: { adSoyad: true, kullaniciAdi: true } } }
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
  if (karar && "conflict" in karar) return jsonError(ALREADY_PROCESSED_MESSAGE, 409);

  return Response.json({ karar, message: "Onay talebi reddedildi." });
}
