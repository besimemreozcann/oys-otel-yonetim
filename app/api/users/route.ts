import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, prismaErrorResponse, requireApiSession } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  adSoyad: z.string().min(2),
  kullaniciAdi: z.string().min(3),
  sifre: z.string().min(6),
  rol: z.enum(["ADMIN", "PERSONEL"])
});

export async function GET() {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Kullanıcı listesini yalnızca SUPER_ADMIN görebilir.", 403);
  const users = await prisma.kullanici.findMany({
    select: {
      id: true,
      adSoyad: true,
      kullaniciAdi: true,
      rol: true,
      aktifMi: true,
      createdAt: true,
      updatedAt: true,
      otelYetkileri: true
    },
    orderBy: { adSoyad: "asc" }
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Kullanıcı eklemek için SUPER_ADMIN yetkisi gerekir.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Kullanıcı bilgilerini kontrol edin.", 400);

  try {
    const user = await prisma.kullanici.create({
      data: {
        adSoyad: parsed.data.adSoyad,
        kullaniciAdi: parsed.data.kullaniciAdi,
        sifreHash: await hashPassword(parsed.data.sifre),
        rol: parsed.data.rol
      },
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
      }) ?? jsonError("Kullanıcı kaydedilemedi.", 500)
    );
  }
}
