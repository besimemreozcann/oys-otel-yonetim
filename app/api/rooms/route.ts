import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  otelId: z.coerce.number().int().positive(),
  katId: z.coerce.number().int().positive(),
  odaNo: z.string().min(1),
  odaTipi: z.string().optional(),
  kapasite: z.coerce.number().int().positive(),
  aciklama: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Oda bilgilerini kontrol edin.", 400);
  const permission = await requireApiHotelPermission(parsed.data.otelId, "otel", "GORUNTULE");
  if (permission.error) return permission.error;

  const floor = await prisma.kat.findFirst({
    where: { id: parsed.data.katId, otelId: parsed.data.otelId }
  });
  if (!floor) return jsonError("Seçilen kat bu otele ait değil.", 400);

  try {
    const room = await prisma.oda.create({
      data: parsed.data
    });
    return NextResponse.json({ room });
  } catch (error) {
    return (
      prismaErrorResponse(error, {
        unique: "Bu oda numarası bu otelde zaten kayıtlı.",
        foreignKey: "Seçilen otel veya kat bulunamadı."
      }) ?? jsonError("Oda kaydedilemedi.", 500)
    );
  }
}
