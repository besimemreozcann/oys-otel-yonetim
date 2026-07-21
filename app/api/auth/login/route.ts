import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

const schema = z.object({
  kullaniciAdi: z.string().min(1),
  sifre: z.string().min(1),
  beniHatirla: z.string().optional()
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = "$2b$12$KIXhE2Cf1tBEkJ6nN.3LO.lCN8rBKmBOtOVZ2HuEXc0D0v9Qx6/rO";
const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimitKey(request: Request, username: string) {
  return `${clientIp(request)}:${username.trim().toLowerCase()}`;
}

function isRateLimited(key: string, now = Date.now()) {
  const item = failedLoginAttempts.get(key);
  if (!item) return false;
  if (item.resetAt <= now) {
    failedLoginAttempts.delete(key);
    return false;
  }
  return item.count >= LOGIN_MAX_FAILED_ATTEMPTS;
}

// Küçük ölçekte in-memory sayaç yeterli; ölçek büyürse Redis gibi paylaşımlı bir store'a taşınmalı.
function recordFailedLogin(key: string, now = Date.now()) {
  const current = failedLoginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    failedLoginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  failedLoginAttempts.set(key, { count: current.count + 1, resetAt: current.resetAt });
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Kullanıcı adı veya şifre eksik.", 400);

  try {
    const key = rateLimitKey(request, parsed.data.kullaniciAdi);
    const limited = isRateLimited(key);

    const user = await prisma.kullanici.findUnique({
      where: { kullaniciAdi: parsed.data.kullaniciAdi }
    });
    const passwordHash = user?.sifreHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(parsed.data.sifre, passwordHash);

    if (!user || !user.aktifMi || !passwordMatches) {
      if (limited) {
        return jsonError("Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.", 429);
      }
      recordFailedLogin(key);
      return jsonError("Kullanıcı adı veya şifre hatalı.", 401);
    }
    failedLoginAttempts.delete(key);

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
