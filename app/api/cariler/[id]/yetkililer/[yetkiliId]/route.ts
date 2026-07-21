import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, parseJsonBody, prismaErrorResponse, requireApiAnyCariPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  otelId: z.number().int().positive(),
  adSoyad: z.string().min(2).optional(),
  gorev: z.string().optional().nullable(),
  telefon: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  eposta: z.string().email().optional().nullable().or(z.literal(""))
});

type RouteContext = {
  params: Promise<any>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Yetkili bilgilerini kontrol edin.", 400);

  const permission = await requireApiAnyCariPermission("TAM");
  if (permission.error) return permission.error;

  const { id: rawCariId, yetkiliId: rawYetkiliId } = await params;
  const cariId = intParam(rawCariId, "Cari");
  const id = intParam(rawYetkiliId, "Yetkili");

  try {
    const yetkili = await prisma.cariYetkili.update({
      where: { id },
      data: {
        cariId,
        adSoyad: parsed.data.adSoyad,
        gorev: parsed.data.gorev || null,
        telefon: parsed.data.telefon || null,
        whatsapp: parsed.data.whatsapp || null,
        eposta: parsed.data.eposta || null
      }
    });
    return NextResponse.json({ yetkili });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("Yetkili güncellenemedi.", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const permission = await requireApiAnyCariPermission("TAM");
  if (permission.error) return permission.error;

  const { yetkiliId: rawYetkiliId } = await params;
  const id = intParam(rawYetkiliId, "Yetkili");
  await prisma.cariYetkili.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
