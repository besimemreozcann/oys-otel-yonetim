import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  otelId: z.coerce.number().int().positive(),
  ad: z.string().min(1),
  sira: z.coerce.number().int().default(0)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Kat bilgilerini kontrol edin.", 400);
  const permission = await requireApiHotelPermission(parsed.data.otelId, "otel", "GORUNTULE");
  if (permission.error) return permission.error;

  try {
    const floor = await prisma.kat.create({
      data: parsed.data
    });
    return NextResponse.json({ floor });
  } catch (error) {
    return (
      prismaErrorResponse(error, {
        unique: "Bu kat adı bu otelde zaten kayıtlı.",
        foreignKey: "Seçilen otel bulunamadı."
      }) ?? jsonError("Kat kaydedilemedi.", 500)
    );
  }
}
