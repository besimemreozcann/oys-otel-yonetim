import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, prismaErrorResponse, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const permissionSchema = z.object({
  otelId: z.number().int().positive(),
  rezervasyonYetkisi: z.enum(["YOK", "GORUNTULE", "EKLE", "TAM"]),
  cariYetkisi: z.enum(["YOK", "GORUNTULE", "TAHSILAT", "TAM"]),
  finansYetkisi: z.enum(["YOK", "GORUNTULE", "SINIRLI", "TAM"]),
  raporYetkisi: z.enum(["YOK", "GORUNTULE", "TAM"])
});

const schema = z.object({
  permissions: z.array(permissionSchema)
});

type RouteContext = {
  params: Promise<any>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Yetki matrisi için SUPER_ADMIN yetkisi gerekir.", 403);

  const { id: rawId } = await params;
  const kullaniciId = intParam(rawId, "Kullanıcı");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Yetki matrisi geçerli değil.", 400);

  const requestedHotelIds = [...new Set(parsed.data.permissions.map((permission) => permission.otelId))];
  const existingHotelCount = await prisma.otel.count({
    where: { id: { in: requestedHotelIds }, silindiMi: false }
  });

  if (existingHotelCount !== requestedHotelIds.length) {
    return jsonError("Yetki matrisinde geçersiz otel seçimi var.", 400);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.kullaniciOtelYetkisi.deleteMany({ where: { kullaniciId } });
      await tx.kullaniciOtelYetkisi.createMany({
        data: parsed.data.permissions
          .filter(
            (permission) =>
              permission.rezervasyonYetkisi !== "YOK" ||
              permission.cariYetkisi !== "YOK" ||
              permission.finansYetkisi !== "YOK" ||
              permission.raporYetkisi !== "YOK"
          )
          .map((permission) => ({ kullaniciId, ...permission }))
      });
    });
  } catch (error) {
    return (
      prismaErrorResponse(error, {
        unique: "Bu kullanıcı için aynı otel yetkisi birden fazla kez gönderildi.",
        foreignKey: "Kullanıcı veya otel kaydı bulunamadı."
      }) ?? jsonError("Yetki matrisi kaydedilemedi.", 500)
    );
  }

  return NextResponse.json({ ok: true });
}
