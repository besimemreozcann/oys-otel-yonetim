import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiSession } from "@/lib/api";
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
    include: { otelYetkileri: true },
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

  const user = await prisma.kullanici.create({
    data: {
      adSoyad: parsed.data.adSoyad,
      kullaniciAdi: parsed.data.kullaniciAdi,
      sifreHash: await hashPassword(parsed.data.sifre),
      rol: parsed.data.rol
    }
  });
  return NextResponse.json({ user });
}
