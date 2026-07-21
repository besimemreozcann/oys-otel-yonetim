import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, parseJsonBody, requireApiHotelAccess } from "@/lib/api";
import { clampRoomPosition } from "@/lib/kroki";
import { prisma } from "@/lib/prisma";

const positionSchema = z.object({
  krokiX: z.number().nullable(),
  krokiY: z.number().nullable(),
  krokiGenislik: z.number().nullable(),
  krokiYukseklik: z.number().nullable()
});

type RouteContext = {
  params: Promise<any>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { roomId: rawRoomId } = await params;
  const roomId = intParam(rawRoomId, "Oda");
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = positionSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("Oda konumu geçerli değil.", 400);

  const room = await prisma.oda.findFirst({
    where: { id: roomId, silindiMi: false },
    select: { id: true, otelId: true }
  });
  if (!room) return jsonError("Oda bulunamadı.", 404);

  const access = await requireApiHotelAccess(room.otelId);
  if (access.error) return access.error;

  const position = clampRoomPosition({ id: roomId, ...parsed.data });
  const updated = await prisma.oda.update({
    where: { id: roomId },
    data: {
      krokiX: position.krokiX,
      krokiY: position.krokiY,
      krokiGenislik: position.krokiGenislik,
      krokiYukseklik: position.krokiYukseklik
    }
  });

  return NextResponse.json({ oda: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { roomId: rawRoomId } = await params;
  const roomId = intParam(rawRoomId, "Oda");

  const room = await prisma.oda.findFirst({
    where: { id: roomId, silindiMi: false },
    select: { id: true, otelId: true }
  });
  if (!room) return jsonError("Oda bulunamadı.", 404);

  const access = await requireApiHotelAccess(room.otelId);
  if (access.error) return access.error;

  await prisma.oda.update({
    where: { id: roomId },
    data: { krokiX: null, krokiY: null, krokiGenislik: null, krokiYukseklik: null }
  });

  return NextResponse.json({ ok: true });
}
