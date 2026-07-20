import { jsonError, requireApiSession } from "@/lib/api";
import { buildDenetimReport, defaultEnd, defaultStart } from "@/lib/reports";

export async function GET(request: Request) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Islem loglarini gormek icin SUPER_ADMIN yetkisi gerekir.", 403);

  const { searchParams } = new URL(request.url);
  const report = await buildDenetimReport({
    otelId: searchParams.get("otelId") ? Number(searchParams.get("otelId")) : undefined,
    kullaniciId: searchParams.get("kullaniciId") ? Number(searchParams.get("kullaniciId")) : undefined,
    islemTuru: searchParams.get("islemTuru") || undefined,
    baslangic: searchParams.get("baslangic") ?? defaultStart(7),
    bitis: searchParams.get("bitis") ?? defaultEnd(),
    skip: searchParams.get("skip") ? Number(searchParams.get("skip")) : 0,
    take: searchParams.get("take") ? Number(searchParams.get("take")) : 50
  });

  return Response.json(report);
}
