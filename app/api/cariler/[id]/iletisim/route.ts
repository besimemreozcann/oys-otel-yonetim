import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, parseJsonBody, prismaErrorResponse, requireApiAnyCariPermission } from "@/lib/api";
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
  const { id: rawId } = await params;
  const cariId = intParam(rawId, "Cari");

  const permission = await requireApiAnyCariPermission("GORUNTULE");
  if (permission.error) return permission.error;

  const kayitlar = await prisma.iletisimKaydi.findMany({
    where: { cariId },
    orderBy: { tarihSaat: "desc" },
    include: { kullanici: { select: { adSoyad: true } } }
  });
  return NextResponse.json({ kayitlar });
}

export async function POST(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("İletişim kaydı bilgilerini kontrol edin.", 400);

  const permission = await requireApiAnyCariPermission("TAHSILAT");
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
