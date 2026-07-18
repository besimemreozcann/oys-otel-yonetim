import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  otelId: z.number().int().positive(),
  tur: z.enum(["ARANDI", "ULASILAMADI", "GERI_DONUS_BEKLENIYOR", "WHATSAPP", "NOT"]),
  aciklama: z.string().optional().nullable()
});

type RouteContext = {
  params: Promise<any>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { searchParams } = new URL(request.url);
  const { id: rawId } = await params;
  const cariId = intParam(rawId, "Cari");
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "cari", "GORUNTULE");
  if (permission.error) return permission.error;

  const kayitlar = await prisma.iletisimKaydi.findMany({
    where: { cariId },
    orderBy: { tarihSaat: "desc" },
    include: { kullanici: { select: { adSoyad: true } } }
  });
  return NextResponse.json({ kayitlar });
}

export async function POST(request: Request, { params }: RouteContext) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("İletişim kaydı bilgilerini kontrol edin.", 400);

  const permission = await requireApiHotelPermission(parsed.data.otelId, "cari", "GORUNTULE");
  if (permission.error || !permission.session) return permission.error;

  const { id: rawId } = await params;
  const cariId = intParam(rawId, "Cari");

  try {
    const kayit = await prisma.iletisimKaydi.create({
      data: {
        cariId,
        kullaniciId: permission.session.id,
        tur: parsed.data.tur,
        aciklama: parsed.data.aciklama || null
      },
      include: { kullanici: { select: { adSoyad: true } } }
    });
    return NextResponse.json({ kayit }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("İletişim kaydı oluşturulamadı.", 500);
  }
}
