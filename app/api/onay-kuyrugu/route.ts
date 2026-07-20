import { Prisma } from "@prisma/client";
import { jsonError, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol === "PERSONEL") return jsonError("Onay kuyrugunu gormek icin yonetici yetkisi gerekir.", 403);

  const { searchParams } = new URL(request.url);
  const requestedHotelId = searchParams.get("otelId") ? Number(searchParams.get("otelId")) : undefined;
  const durum = searchParams.get("durum") || undefined;
  const permissions = await prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } });
  const allowedHotelIds =
    session.rol === "SUPER_ADMIN"
      ? undefined
      : permissions.map((permission) => permission.otelId);
  if (allowedHotelIds && requestedHotelId && !allowedHotelIds.includes(requestedHotelId)) {
    return jsonError("Bu otele ait onay taleplerini gormeye yetkiniz yok.", 403);
  }
  const where: Prisma.OnayTalebiWhereInput = {
    tur: "REZERVASYON_SILME",
    ...(durum ? { durum: durum as any } : {}),
    ...(requestedHotelId ? { otelId: requestedHotelId } : allowedHotelIds ? { otelId: { in: allowedHotelIds } } : {})
  };

  const talepler = await prisma.onayTalebi.findMany({
    where,
    include: {
      talepEden: { select: { adSoyad: true, kullaniciAdi: true } },
      kararVeren: { select: { adSoyad: true, kullaniciAdi: true } },
      otel: { select: { ad: true } }
    },
    orderBy: [{ durum: "asc" }, { createdAt: "desc" }]
  });

  return Response.json({ talepler });
}
