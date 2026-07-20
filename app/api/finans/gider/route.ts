import { z } from "zod";
import { centsToDecimalString, dateOnly, decimalToCents } from "@/lib/faz3";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const giderSchema = z.object({
  otelId: z.number().int().positive(),
  hesapId: z.number().int().positive(),
  cariId: z.number().int().positive().optional().nullable(),
  kategori: z.string().min(2),
  tutar: z.string().min(1),
  aciklama: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const otelId = intParam(searchParams.get("otelId"), "Otel");
  const permission = await requireApiHotelPermission(otelId, "finans", "GORUNTULE");
  if (permission.error) return permission.error;

  const baslangic = searchParams.get("baslangic");
  const bitis = searchParams.get("bitis");
  const kategori = searchParams.get("kategori");
  const giderler = await prisma.hesapHareket.findMany({
    where: {
      hesap: { otelId },
      tur: { in: ["GIDER", "ODEME"] },
      silindiMi: false,
      ...(baslangic ? { tarih: { gte: dateOnly(baslangic) } } : {}),
      ...(bitis ? { tarih: { lte: dateOnly(bitis) } } : {}),
      ...(kategori ? { kategori } : {})
    },
    include: {
      hesap: { select: { ad: true } },
      olusturan: { select: { adSoyad: true, kullaniciAdi: true } },
      cariHareket: { include: { cari: { select: { ad: true } } } }
    },
    orderBy: { tarih: "desc" },
    take: 20
  });

  return Response.json({ giderler });
}

export async function POST(request: Request) {
  const parsed = giderSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Gider bilgilerini kontrol edin.", 400);

  const data = parsed.data;
  const permission = await requireApiHotelPermission(data.otelId, "finans", "SINIRLI");
  if (permission.error || !permission.session) return permission.error;

  const tutarCents = decimalToCents(data.tutar);
  if (tutarCents <= 0) return jsonError("Gider tutarı sıfırdan büyük olmalıdır.", 400);

  const hesap = await prisma.hesap.findFirst({ where: { id: data.hesapId, otelId: data.otelId, silindiMi: false, aktifMi: true } });
  if (!hesap) return jsonError("Hesap bulunamadı veya aktif değil.", 400);

  const cari = data.cariId ? await prisma.cari.findFirst({ where: { id: data.cariId, silindiMi: false, aktifMi: true } }) : null;
  if (data.cariId && !cari) return jsonError("Cari bulunamadı veya aktif değil.", 400);

  const tutar = centsToDecimalString(tutarCents);
  const result = await prisma.$transaction(async (tx) => {
    const cariHareket = cari
      ? await tx.cariHareket.create({
          data: {
            otelId: data.otelId,
            cariId: cari.id,
            tur: "ODEME",
            borc: "0.00",
            alacak: tutar,
            aciklama: data.aciklama || `${data.kategori} ödemesi`,
            olusturanId: permission.session.id
          }
        })
      : null;

    const hesapHareket = await tx.hesapHareket.create({
      data: {
        hesapId: data.hesapId,
        tur: cari ? "ODEME" : "GIDER",
        tutar,
        cariHareketId: cariHareket?.id,
        kategori: data.kategori,
        aciklama: data.aciklama || `${data.kategori} gideri`,
        olusturanId: permission.session.id
      }
    });

    await tx.islemLogu.create({
      data: {
        kullaniciId: permission.session.id,
        otelId: data.otelId,
        islemTuru: cari ? "FINANS_CARI_ODEME" : "FINANS_GIDER",
        tablo: "HesapHareket",
        kayitId: hesapHareket.id,
        yeniDeger: { hesapId: data.hesapId, cariId: cari?.id ?? null, kategori: data.kategori, tutar },
        aciklama: cari ? `Cariye ödeme kaydedildi: ${cari.ad}, ${tutar}` : `Gider kaydedildi: ${data.kategori}, ${tutar}`
      }
    });

    return { hesapHareket, cariHareket };
  });

  return Response.json(result, { status: 201 });
}
