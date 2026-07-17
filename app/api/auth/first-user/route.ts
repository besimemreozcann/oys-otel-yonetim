import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { jsonError, prismaErrorResponse } from "@/lib/api";

const schema = z.object({
  adSoyad: z.string().min(2),
  kullaniciAdi: z.string().min(3),
  sifre: z.string().min(6)
});

class RegistrationClosedError extends Error {}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Bilgileri kontrol edip tekrar deneyin.", 400);

  let user;
  try {
    user = await prisma.$transaction(
      async (tx) => {
        const userCount = await tx.kullanici.count();
        if (userCount > 0) {
          throw new RegistrationClosedError();
        }

        return tx.kullanici.create({
          data: {
            adSoyad: parsed.data.adSoyad,
            kullaniciAdi: parsed.data.kullaniciAdi,
            sifreHash: await hashPassword(parsed.data.sifre),
            rol: "SUPER_ADMIN"
          },
          select: { id: true, adSoyad: true, kullaniciAdi: true, rol: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof RegistrationClosedError) {
      return jsonError("Kayıt kapalı. Yeni kullanıcılar panelden eklenir.", 403);
    }

    return (
      prismaErrorResponse(error, {
        unique: "Bu kullanıcı adı zaten kayıtlı."
      }) ?? jsonError("İlk kullanıcı oluşturulamadı.", 500)
    );
  }

  const token = await createSessionToken(user, false);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return NextResponse.json({ ok: true });
}
