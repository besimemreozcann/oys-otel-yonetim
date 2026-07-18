import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

const schema = z.object({
  kullaniciAdi: z.string().min(1),
  sifre: z.string().min(1),
  beniHatirla: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Kullanıcı adı veya şifre eksik.", 400);

  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciAdi: parsed.data.kullaniciAdi }
    });

    if (!user || !user.aktifMi || !(await verifyPassword(parsed.data.sifre, user.sifreHash))) {
      return jsonError("Kullanıcı adı veya şifre hatalı.", 401);
    }

    const remember = parsed.data.beniHatirla === "true";
    const token = await createSessionToken(
      { id: user.id, adSoyad: user.adSoyad, kullaniciAdi: user.kullaniciAdi, rol: user.rol },
      remember
    );
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8
    });

    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Giriş işlemi tamamlanamadı. Lütfen daha sonra tekrar deneyin.", 500);
  }
}
