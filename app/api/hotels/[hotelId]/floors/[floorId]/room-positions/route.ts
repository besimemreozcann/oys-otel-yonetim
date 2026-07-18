import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, requireApiHotelAccess } from "@/lib/api";
import { clampRoomPosition, generatedKrokiSvg, hasDuplicateRoomIds } from "@/lib/kroki";
import { prisma } from "@/lib/prisma";

const roomPositionSchema = z.object({
  id: z.number().int().positive(),
  krokiX: z.number().nullable(),
  krokiY: z.number().nullable(),
  krokiGenislik: z.number().nullable(),
  krokiYukseklik: z.number().nullable()
});

const schema = z.object({
  odalar: z.array(roomPositionSchema)
});

type RouteContext = {
  params: Promise<any>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  const { hotelId: rawHotelId, floorId: rawFloorId } = await params;
  const otelId = intParam(rawHotelId, "Otel");
  const katId = intParam(rawFloorId, "Kat");

  const access = await requireApiHotelAccess(otelId);
  if (access.error) return access.error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Kroki konumları geçerli değil.", 400);
  if (hasDuplicateRoomIds(parsed.data.odalar)) return jsonError("Aynı oda birden fazla kez gönderilemez.", 400);

  const floor = await prisma.kat.findFirst({
    where: { id: katId, otelId },
    select: { id: true, ad: true, otel: { select: { ad: true } } }
  });
  if (!floor) return jsonError("Seçilen kat bu otele ait değil.", 400);

  const roomIds = parsed.data.odalar.map((room) => room.id);
  const validRoomCount = await prisma.oda.count({
    where: { id: { in: roomIds }, otelId, katId, silindiMi: false }
  });
  if (validRoomCount !== roomIds.length) {
    return jsonError("Gönderilen odaların tamamı seçilen otel ve kata ait olmalıdır.", 400);
  }

  const positions = parsed.data.odalar.map(clampRoomPosition);

  await prisma.$transaction(async (tx) => {
    for (const position of positions) {
      await tx.oda.update({
        where: { id: position.id },
        data: {
          krokiX: position.krokiX,
          krokiY: position.krokiY,
          krokiGenislik: position.krokiGenislik,
          krokiYukseklik: position.krokiYukseklik
        }
      });
    }

    const sketch = await tx.kroki.findFirst({ where: { otelId, katId }, select: { id: true } });
    const data = {
      otelId,
      katId,
      ad: `${floor.otel.ad} - ${floor.ad} Krokisi`,
      svgVeri: generatedKrokiSvg(floor.otel.ad, floor.ad)
    };

    if (sketch) {
      await tx.kroki.update({ where: { id: sketch.id }, data });
    } else {
      await tx.kroki.create({ data });
    }
  });

  return NextResponse.json({ ok: true });
}
