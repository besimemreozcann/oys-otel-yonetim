import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { hasHotelPermission, type PermissionDomain } from "@/lib/authz";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export function intParam(value: string | null, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} geçerli değil.`);
  }
  return parsed;
}

export async function requireApiSession() {
  const session = await readSession();
  if (!session) {
    return { error: jsonError("Oturum bulunamadı. Lütfen giriş yapın.", 401), session: null };
  }
  return { error: null, session };
}

export async function requireApiHotelPermission(
  otelId: number,
  domain: PermissionDomain,
  required = "GORUNTULE"
) {
  const { error, session } = await requireApiSession();
  if (error || !session) return { error, session: null };

  const permissions = await prisma.kullaniciOtelYetkisi.findMany({
    where: { kullaniciId: session.id }
  });
  const decision = hasHotelPermission(session, permissions, otelId, domain, required);

  if (!decision.allowed) {
    return { error: jsonError(decision.message, decision.status), session: null };
  }

  return { error: null, session };
}
