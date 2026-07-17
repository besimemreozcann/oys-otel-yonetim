import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ad: z.string().min(2),
  adres: z.string().optional(),
  telefon: z.string().optional(),
  eposta: z.string().email().optional().or(z.literal(""))
});

export async function GET() {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  const permissions = await prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } });
  const hotels = await prisma.otel.findMany({
    where: {
      silindiMi: false,
      aktifMi: true,
      ...(session.rol === "SUPER_ADMIN" ? {} : { id: { in: permissions.map((item) => item.otelId) } })
    },
    orderBy: { ad: "asc" }
  });
  return NextResponse.json({ hotels });
}

export async function POST(request: Request) {
  const { error, session } = await requireApiSession();
  if (error || !session) return error;
  if (session.rol !== "SUPER_ADMIN") return jsonError("Otel eklemek için SUPER_ADMIN yetkisi gerekir.", 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Otel bilgilerini kontrol edin.", 400);

  const company =
    (await prisma.sirket.findFirst({ orderBy: { id: "asc" } })) ??
    (await prisma.sirket.create({ data: { ad: "Ana Şirket" } }));
  const hotel = await prisma.otel.create({
    data: {
      sirketId: company.id,
      ad: parsed.data.ad,
      adres: parsed.data.adres,
      telefon: parsed.data.telefon,
      eposta: parsed.data.eposta || null
    }
  });

  return NextResponse.json({ hotel });
}
