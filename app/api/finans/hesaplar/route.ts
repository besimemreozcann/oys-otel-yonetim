import { NextResponse } from "next/server";
import { z } from "zod";
import { centsToDecimalString } from "@/lib/faz3";
import { calculateAccountBalanceCents } from "@/lib/finance";
import { intParam, jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const hesapSchema = z.object({
  otelId: z.number().int().positive(),
  tur: z.enum(["NAKIT_KASA", "BANKA"]),
  ad: z.string().min(2),
  bankaAdi: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  aktifMi: z.boolean().optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "finans", "GORUNTULE");
  if (permission.error) return permission.error;

  const hesaplar = await prisma.hesap.findMany({
    where: { otelId, silindiMi: false },
    include: { hareketler: { where: { silindiMi: false }, select: { tur: true, tutar: true } } },
    orderBy: [{ aktifMi: "desc" }, { tur: "asc" }, { ad: "asc" }]
  });

  return NextResponse.json({
    hesaplar: hesaplar.map((hesap) => ({
      id: hesap.id,
      tur: hesap.tur,
      ad: hesap.ad,
      bankaAdi: hesap.bankaAdi,
      iban: hesap.iban,
      aktifMi: hesap.aktifMi,
      bakiye: centsToDecimalString(calculateAccountBalanceCents(hesap.hareketler))
    }))
  });
}

export async function POST(request: Request) {
  const parsed = hesapSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Hesap bilgilerini kontrol edin.", 400);

  const permission = await requireApiHotelPermission(parsed.data.otelId, "finans", "TAM");
  if (permission.error || !permission.session) return permission.error;

  try {
    const hesap = await prisma.$transaction(async (tx) => {
      const created = await tx.hesap.create({
        data: {
          otelId: parsed.data.otelId,
          tur: parsed.data.tur,
          ad: parsed.data.ad,
          bankaAdi: parsed.data.tur === "BANKA" ? parsed.data.bankaAdi || null : null,
          iban: parsed.data.tur === "BANKA" ? parsed.data.iban || null : null,
          aktifMi: parsed.data.aktifMi ?? true
        }
      });

      await tx.islemLogu.create({
        data: {
          kullaniciId: permission.session.id,
          otelId: parsed.data.otelId,
          islemTuru: "FINANS_HESAP_OLUSTURMA",
          tablo: "Hesap",
          kayitId: created.id,
          yeniDeger: { ad: created.ad, tur: created.tur },
          aciklama: `Finans hesabı oluşturuldu: ${created.ad}`
        }
      });

      return created;
    });

    return NextResponse.json({ hesap }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("Hesap oluşturulamadı.", 500);
  }
}
