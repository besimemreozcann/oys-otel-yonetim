import { z } from "zod";
import { centsToDecimalString, dateOnly, decimalToCents } from "@/lib/faz3";
import { isValidAccountForPaymentMethod } from "@/lib/finance";
import { intParam, jsonError, parseJsonBody, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validateTutarCents } from "@/lib/validation";

const tahsilatSchema = z.object({
  otelId: z.number().int().positive(),
  cariId: z.number().int().positive(),
  hesapId: z.number().int().positive(),
  tutar: z.string().min(1),
  odemeYontemi: z.enum(["NAKIT", "HAVALE", "EFT", "KART"]),
  aciklama: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const otelId = intParam(searchParams.get("otelId"), "Otel");
  const permission = await requireApiHotelPermission(otelId, "finans", "GORUNTULE");
  if (permission.error) return permission.error;

  const baslangic = searchParams.get("baslangic");
  const bitis = searchParams.get("bitis");
  const tahsilatlar = await prisma.cariHareket.findMany({
    where: {
      otelId,
      tur: "TAHSILAT",
      silindiMi: false,
      ...(baslangic ? { tarih: { gte: dateOnly(baslangic) } } : {}),
      ...(bitis ? { tarih: { lte: dateOnly(bitis) } } : {})
    },
    include: {
      cari: { select: { ad: true } },
      olusturan: { select: { adSoyad: true, kullaniciAdi: true } },
      hesapHareketler: { include: { hesap: { select: { ad: true } } } }
    },
    orderBy: { tarih: "desc" },
    take: 20
  });

  return Response.json({ tahsilatlar });
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = tahsilatSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("Tahsilat bilgilerini kontrol edin.", 400);

  const data = parsed.data;
  const permission = await requireApiHotelPermission(data.otelId, "finans", "SINIRLI");
  if (permission.error || !permission.session) return permission.error;

  const tutarCents = decimalToCents(data.tutar);
  const tutarError = validateTutarCents(tutarCents, "Tahsilat tutarı");
  if (tutarError) return jsonError(tutarError, 400);

  const [cari, hesap] = await Promise.all([
    prisma.cari.findFirst({ where: { id: data.cariId, silindiMi: false, aktifMi: true } }),
    prisma.hesap.findFirst({ where: { id: data.hesapId, otelId: data.otelId, silindiMi: false, aktifMi: true } })
  ]);
  if (!cari) return jsonError("Cari bulunamadı veya aktif değil.", 400);
  if (!hesap) return jsonError("Hesap bulunamadı veya aktif değil.", 400);
  if (!isValidAccountForPaymentMethod(data.odemeYontemi, hesap.tur)) {
    return jsonError("Seçilen ödeme yöntemi bu hesap türüyle uyumlu değil.", 400);
  }

  const tutar = centsToDecimalString(tutarCents);
  const result = await prisma.$transaction(async (tx) => {
    const cariHareket = await tx.cariHareket.create({
      data: {
        otelId: data.otelId,
        cariId: data.cariId,
        tur: "TAHSILAT",
        borc: "0.00",
        alacak: tutar,
        odemeYontemi: data.odemeYontemi,
        aciklama: data.aciklama || `Tahsilat: ${cari.ad}`,
        olusturanId: permission.session.id
      }
    });

    const hesapHareket = await tx.hesapHareket.create({
      data: {
        hesapId: data.hesapId,
        tur: "TAHSILAT",
        tutar,
        cariHareketId: cariHareket.id,
        aciklama: data.aciklama || `${cari.ad} tahsilatı`,
        olusturanId: permission.session.id
      }
    });

    await tx.islemLogu.create({
      data: {
        kullaniciId: permission.session.id,
        otelId: data.otelId,
        islemTuru: "FINANS_TAHSILAT",
        tablo: "CariHareket",
        kayitId: cariHareket.id,
        yeniDeger: { cariId: data.cariId, hesapId: data.hesapId, tutar, odemeYontemi: data.odemeYontemi },
        aciklama: `Tahsilat kaydedildi: ${cari.ad}, ${tutar}`
      }
    });

    return { cariHareket, hesapHareket };
  });

  return Response.json(result, { status: 201 });
}
