import { z } from "zod";
import { centsToDecimalString, dateOnly, decimalToCents } from "@/lib/faz3";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const virmanSchema = z.object({
  otelId: z.number().int().positive(),
  kaynakHesapId: z.number().int().positive(),
  hedefHesapId: z.number().int().positive(),
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
  const virmanlar = await prisma.hesapHareket.findMany({
    where: {
      hesap: { otelId },
      tur: "VIRMAN_CIKIS",
      silindiMi: false,
      ...(baslangic ? { tarih: { gte: dateOnly(baslangic) } } : {}),
      ...(bitis ? { tarih: { lte: dateOnly(bitis) } } : {})
    },
    include: {
      hesap: { select: { ad: true } },
      karsiHesap: { select: { ad: true } },
      olusturan: { select: { adSoyad: true, kullaniciAdi: true } }
    },
    orderBy: { tarih: "desc" },
    take: 20
  });

  return Response.json({ virmanlar });
}

export async function POST(request: Request) {
  const parsed = virmanSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Virman bilgilerini kontrol edin.", 400);

  const data = parsed.data;
  if (data.kaynakHesapId === data.hedefHesapId) return jsonError("Kaynak ve hedef hesap aynı olamaz.", 400);

  const permission = await requireApiHotelPermission(data.otelId, "finans", "TAM");
  if (permission.error || !permission.session) return permission.error;

  const tutarCents = decimalToCents(data.tutar);
  if (tutarCents <= 0) return jsonError("Virman tutarı sıfırdan büyük olmalıdır.", 400);

  const [kaynak, hedef] = await Promise.all([
    prisma.hesap.findFirst({ where: { id: data.kaynakHesapId, otelId: data.otelId, silindiMi: false, aktifMi: true } }),
    prisma.hesap.findFirst({ where: { id: data.hedefHesapId, otelId: data.otelId, silindiMi: false, aktifMi: true } })
  ]);
  if (!kaynak) return jsonError("Kaynak hesap bulunamadı veya aktif değil.", 400);
  if (!hedef) return jsonError("Hedef hesap bulunamadı veya aktif değil.", 400);

  const tutar = centsToDecimalString(tutarCents);
  const result = await prisma.$transaction(async (tx) => {
    const cikis = await tx.hesapHareket.create({
      data: {
        hesapId: kaynak.id,
        tur: "VIRMAN_CIKIS",
        tutar,
        karsiHesapId: hedef.id,
        aciklama: data.aciklama || `${hedef.ad} hesabına virman`,
        olusturanId: permission.session.id
      }
    });
    const giris = await tx.hesapHareket.create({
      data: {
        hesapId: hedef.id,
        tur: "VIRMAN_GIRIS",
        tutar,
        karsiHesapId: kaynak.id,
        aciklama: data.aciklama || `${kaynak.ad} hesabından virman`,
        olusturanId: permission.session.id
      }
    });

    await tx.islemLogu.create({
      data: {
        kullaniciId: permission.session.id,
        otelId: data.otelId,
        islemTuru: "FINANS_VIRMAN",
        tablo: "HesapHareket",
        kayitId: cikis.id,
        yeniDeger: { kaynakHesapId: kaynak.id, hedefHesapId: hedef.id, tutar },
        aciklama: `Virman kaydedildi: ${kaynak.ad} -> ${hedef.ad}, ${tutar}`
      }
    });

    return { cikis, giris };
  });

  return Response.json(result, { status: 201 });
}
