import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { intParam, jsonError, parseJsonBody, prismaErrorResponse, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  adSoyad: z.string().min(2).optional(),
  rol: z.enum(["ADMIN", "PERSONEL"]).optional(),
  aktifMi: z.boolean().optional()
});

const LAST_SUPER_ADMIN_MESSAGE = "Sistemdeki son aktif süper yöneticiyi pasifleştiremez veya silemezsiniz.";

type RouteContext = {
  params: Promise<any>;
};

class LastSuperAdminError extends Error {}

type UserUpdateData = z.infer<typeof schema>;

const userSelect = {
  id: true,
  adSoyad: true,
  kullaniciAdi: true,
  rol: true,
  aktifMi: true,
  createdAt: true,
  updatedAt: true,
  otelYetkileri: true
} as const;

function removesSuperAdminAccess(data: Pick<UserUpdateData, "rol" | "aktifMi">) {
  return data.aktifMi === false || data.rol !== undefined;
}

async function updateUserWithSuperAdminGuard(userId: number, data: UserUpdateData) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.kullanici.findUnique({
      where: { id: userId },
      select: { rol: true, aktifMi: true }
    });
    const mustVerifyLastSuperAdmin =
      target?.rol === "SUPER_ADMIN" && target.aktifMi && removesSuperAdminAccess(data);

    const user = await tx.kullanici.update({
      where: { id: userId },
      data,
      select: userSelect
    });

    if (mustVerifyLastSuperAdmin) {
      const activeSuperAdminCount = await tx.kullanici.count({
        where: { rol: "SUPER_ADMIN", aktifMi: true }
      });
      if (activeSuperAdminCount === 0) {
        throw new LastSuperAdminError();
      }
    }

    return user;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

async function deactivateUserWithSuperAdminGuard(userId: number) {
  return updateUserWithSuperAdminGuard(userId, { aktifMi: false });
}

function shouldRetrySerializableTransaction(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function withSerializableRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (shouldRetrySerializableTransaction(error)) {
      return operation();
    }
    throw error;
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Bu işlem için SUPER_ADMIN yetkisi gerekir.", 403);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Kullanıcı");
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Kullanıcı bilgilerini kontrol edin.", 400);

  try {
    const user = await withSerializableRetry(() => updateUserWithSuperAdminGuard(id, parsed.data));
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof LastSuperAdminError) {
      return jsonError(LAST_SUPER_ADMIN_MESSAGE, 400);
    }

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
  try {
    await withSerializableRetry(() => deactivateUserWithSuperAdminGuard(id));
  } catch (error) {
    if (error instanceof LastSuperAdminError) {
      return jsonError(LAST_SUPER_ADMIN_MESSAGE, 400);
    }

    return prismaErrorResponse(error) ?? jsonError("Kullanıcı silinemedi.", 500);
  }

  return NextResponse.json({ ok: true });
}
