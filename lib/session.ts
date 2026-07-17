import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { Rol } from "@prisma/client";

export const SESSION_COOKIE = "oys_oturum";

export type SessionUser = {
  id: number;
  adSoyad: string;
  kullaniciAdi: string;
  rol: Rol;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? "gelistirme-ortami-icin-gecici-secret-degeri";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser, remember: boolean) {
  const maxAge = remember ? "30d" : "8h";
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(maxAge)
    .sign(getSecret());
}

export async function readSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = Number(payload.id);
    if (!id) return null;

    const user = await prisma.kullanici.findFirst({
      where: { id, aktifMi: true },
      select: { id: true, adSoyad: true, kullaniciAdi: true, rol: true }
    });

    return user;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (session.rol !== "SUPER_ADMIN") redirect("/dashboard");
  return session;
}
