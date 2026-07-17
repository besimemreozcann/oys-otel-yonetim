import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

type PrismaErrorMessages = {
  unique?: string;
  foreignKey?: string;
};

export function prismaErrorResponse(error: unknown, messages: PrismaErrorMessages = {}) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (error.code === "P2002") {
    return jsonError(messages.unique ?? "Bu kayıt zaten mevcut.", 409);
  }

  if (error.code === "P2003") {
    return jsonError(messages.foreignKey ?? "İlişkili kayıt bulunamadı. Bilgileri kontrol edin.", 400);
  }

  return null;
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
