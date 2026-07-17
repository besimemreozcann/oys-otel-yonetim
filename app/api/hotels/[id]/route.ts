import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ad: z.string().min(2).optional(),
  adres: z.string().optional(),
  telefon: z.string().optional(),
  eposta: z.string().email().optional().or(z.literal("")),
  aktifMi: z.boolean().optional()
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const id = intParam(rawId, "Otel");
  const permission = await requireApiHotelPermission(id, "otel", "GORUNTULE");
  if (permission.error) return permission.error;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Otel bilgilerini kontrol edin.", 400);

  const hotel = await prisma.otel.update({
    where: { id },
    data: {
      ...parsed.data,
      eposta: parsed.data.eposta || null
    }
  });
  return NextResponse.json({ hotel });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const id = intParam(rawId, "Otel");
  const permission = await requireApiHotelPermission(id, "otel", "GORUNTULE");
  if (permission.error) return permission.error;
  await prisma.otel.update({
    where: { id },
    data: { silindiMi: true, silinmeTarihi: new Date(), aktifMi: false }
  });
  return NextResponse.json({ ok: true });
}
