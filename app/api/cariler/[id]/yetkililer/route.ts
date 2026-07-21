import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, parseJsonBody, prismaErrorResponse, requireApiAnyCariPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  otelId: z.number().int().positive(),
  adSoyad: z.string().min(2),
  gorev: z.string().optional().nullable(),
  telefon: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  eposta: z.string().email().optional().nullable().or(z.literal(""))
});

type RouteContext = {
  params: Promise<any>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const cariId = intParam(rawId, "Cari");

  const permission = await requireApiAnyCariPermission("GORUNTULE");
  if (permission.error) return permission.error;

  const yetkililer = await prisma.cariYetkili.findMany({ where: { cariId }, orderBy: { adSoyad: "asc" } });
  return NextResponse.json({ yetkililer });
}

export async function POST(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Yetkili bilgilerini kontrol edin.", 400);

  const permission = await requireApiAnyCariPermission("TAM");
  if (permission.error) return permission.error;

  const { id: rawId } = await params;
  const cariId = intParam(rawId, "Cari");

  try {
    const yetkili = await prisma.cariYetkili.create({
      data: {
        cariId,
        adSoyad: parsed.data.adSoyad,
        gorev: parsed.data.gorev || null,
        telefon: parsed.data.telefon || null,
        whatsapp: parsed.data.whatsapp || null,
        eposta: parsed.data.eposta || null
      }
    });
    return NextResponse.json({ yetkili }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("Yetkili oluşturulamadı.", 500);
  }
}
