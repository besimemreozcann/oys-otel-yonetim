import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, requireApiSession } from "@/lib/api";
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
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Yetki matrisi için SUPER_ADMIN yetkisi gerekir.", 403);

  const { id: rawId } = await params;
  const kullaniciId = intParam(rawId, "Kullanıcı");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Yetki matrisi geçerli değil.", 400);

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

  return NextResponse.json({ ok: true });
}
