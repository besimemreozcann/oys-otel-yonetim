import { NextResponse } from "next/server";
import { z } from "zod";
import { intParam, jsonError, prismaErrorResponse, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  adSoyad: z.string().min(2).optional(),
  rol: z.enum(["ADMIN", "PERSONEL"]).optional(),
  aktifMi: z.boolean().optional()
});

type RouteContext = {
  params: Promise<any>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Bu işlem için SUPER_ADMIN yetkisi gerekir.", 403);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Kullanıcı");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Kullanıcı bilgilerini kontrol edin.", 400);

  try {
    const user = await prisma.kullanici.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        adSoyad: true,
        kullaniciAdi: true,
        rol: true,
        aktifMi: true,
        createdAt: true,
        updatedAt: true,
        otelYetkileri: true
      }
    });
    return NextResponse.json({ user });
  } catch (error) {
    return (
      prismaErrorResponse(error, {
        unique: "Bu kullanıcı adı zaten kayıtlı."
      }) ?? jsonError("Kullanıcı güncellenemedi.", 500)
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Bu işlem için SUPER_ADMIN yetkisi gerekir.", 403);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Kullanıcı");
  await prisma.kullanici.update({ where: { id }, data: { aktifMi: false } });
  return NextResponse.json({ ok: true });
}
