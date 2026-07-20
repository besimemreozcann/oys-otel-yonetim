import { NextResponse } from "next/server";
import { z } from "zod";
import {
  centsToDecimalString,
  dateOnly,
  decimalToCents,
  formatDateTR,
  isReservationConflictError,
  nightCount
} from "@/lib/faz3";
import { isValidAccountForPaymentMethod } from "@/lib/finance";
import { intParam, jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  otelId: z.number().int().positive(),
  odaId: z.number().int().positive(),
  cariSecim: z.enum(["MEVCUT", "YENI"]).default("MEVCUT"),
  cariId: z.number().int().positive().optional(),
  yeniCari: z
    .object({
      ad: z.string().min(2),
      tur: z.enum(["TUR_SIRKETI", "ACENTE", "KURUMSAL", "TEDARIKCI", "BIREYSEL"]).default("BIREYSEL"),
      vergiNo: z.string().optional().nullable(),
      vergiDairesi: z.string().optional().nullable(),
      adres: z.string().optional().nullable(),
      telefon: z.string().optional().nullable(),
      whatsapp: z.string().optional().nullable(),
      eposta: z.string().email().optional().nullable().or(z.literal(""))
    })
    .optional(),
  girisTarihi: z.string().min(10),
  girisSaati: z.string().default("14:00"),
  cikisTarihi: z.string().min(10),
  cikisSaati: z.string().default("12:00"),
  kisiSayisi: z.number().int().positive(),
  ucretTipi: z.enum(["TOPLAM", "KISI_BASI"]),
  birimUcret: z.string().optional().nullable(),
  toplamTutar: z.string().optional().nullable(),
  tahsilatTutar: z.string().optional().nullable(),
  odemeYontemi: z.enum(["NAKIT", "HAVALE", "EFT", "KART"]).optional().nullable(),
  hesapId: z.number().int().positive().optional().nullable(),
  not: z.string().optional().nullable()
});

function conflictMessage(giris: string, cikis: string) {
  return `Bu oda ${formatDateTR(giris)} - ${formatDateTR(cikis)} tarihleri arasında dolu. Farklı tarih veya oda seçin.`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "rezervasyon", "GORUNTULE");
  if (permission.error) return permission.error;

  const cariId = searchParams.get("cariId");
  const durum = searchParams.get("durum");
  const baslangic = searchParams.get("baslangic");
  const bitis = searchParams.get("bitis");

  const rezervasyonlar = await prisma.rezervasyon.findMany({
    where: {
      otelId,
      silindiMi: false,
      ...(cariId ? { cariId: Number(cariId) } : {}),
      ...(durum ? { durum: durum as any } : {}),
      ...(baslangic ? { cikisTarihi: { gte: dateOnly(baslangic) } } : {}),
      ...(bitis ? { girisTarihi: { lte: dateOnly(bitis) } } : {})
    },
    include: {
      otel: { select: { ad: true } },
      oda: { select: { odaNo: true, kapasite: true } },
      cari: { select: { ad: true } }
    },
    orderBy: { girisTarihi: "desc" }
  });

  return NextResponse.json({ rezervasyonlar });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Rezervasyon bilgilerini kontrol edin.", 400);

  const data = parsed.data;
  const permission = await requireApiHotelPermission(data.otelId, "rezervasyon", "EKLE");
  if (permission.error || !permission.session) return permission.error;

  if (data.cariSecim === "MEVCUT" && !data.cariId) {
    return jsonError("Cari seçimi zorunludur.", 400);
  }
  if (data.cariSecim === "YENI" && !data.yeniCari) {
    return jsonError("Yeni müşteri bilgilerini kontrol edin.", 400);
  }

  const geceSayisi = nightCount(data.girisTarihi, data.cikisTarihi);
  if (geceSayisi <= 0) return jsonError("Çıkış tarihi giriş tarihinden sonra olmalıdır.", 400);

  const oda = await prisma.oda.findFirst({
    where: { id: data.odaId, otelId: data.otelId, silindiMi: false, aktifMi: true },
    select: { id: true, odaNo: true, kapasite: true }
  });
  if (!oda) return jsonError("Seçilen oda bu otele ait değil veya aktif değil.", 400);

  const existingCari =
    data.cariSecim === "MEVCUT"
      ? await prisma.cari.findFirst({ where: { id: data.cariId, silindiMi: false, aktifMi: true } })
      : null;
  if (data.cariSecim === "MEVCUT" && !existingCari) return jsonError("Seçilen cari bulunamadı veya aktif değil.", 400);

  const birimCents = decimalToCents(data.birimUcret);
  const toplamCents =
    data.ucretTipi === "KISI_BASI"
      ? birimCents * data.kisiSayisi * geceSayisi
      : decimalToCents(data.toplamTutar);
  const tahsilatCents = decimalToCents(data.tahsilatTutar);

  if (toplamCents <= 0) return jsonError("Toplam tutar sıfırdan büyük olmalıdır.", 400);
  if (data.ucretTipi === "KISI_BASI" && birimCents <= 0) {
    return jsonError("Kişi başı ücret sıfırdan büyük olmalıdır.", 400);
  }
  if (tahsilatCents < 0) return jsonError("Tahsilat tutarı negatif olamaz.", 400);
  if (tahsilatCents > toplamCents) return jsonError("Alınan ödeme toplam tutardan büyük olamaz.", 400);

  let hesap: { id: number; ad: string; tur: "NAKIT_KASA" | "BANKA" } | null = null;
  if (tahsilatCents > 0) {
    if (!data.odemeYontemi || !data.hesapId) {
      return jsonError("Ödeme için yöntem ve kasa/banka seçimi zorunludur.", 400);
    }
    const tahsilatPermission = await requireApiHotelPermission(data.otelId, "finans", "SINIRLI");
    if (tahsilatPermission.error) return tahsilatPermission.error;
    hesap = await prisma.hesap.findFirst({
      where: { id: data.hesapId, otelId: data.otelId, silindiMi: false, aktifMi: true },
      select: { id: true, ad: true, tur: true }
    });
    if (!hesap) return jsonError("Seçilen kasa/banka hesabı bulunamadı veya aktif değil.", 400);
    if (!isValidAccountForPaymentMethod(data.odemeYontemi, hesap.tur)) {
      return jsonError("Seçilen ödeme yöntemi bu hesap türüyle uyumlu değil.", 400);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cari =
        existingCari ??
        (await tx.cari.create({
          data: {
            ad: data.yeniCari!.ad,
            tur: data.yeniCari!.tur,
            vergiNo: data.yeniCari!.vergiNo || null,
            vergiDairesi: data.yeniCari!.vergiDairesi || null,
            adres: data.yeniCari!.adres || null,
            telefon: data.yeniCari!.telefon || null,
            whatsapp: data.yeniCari!.whatsapp || null,
            eposta: data.yeniCari!.eposta || null,
            aktifMi: true
          }
        }));

      const rezervasyon = await tx.rezervasyon.create({
        data: {
          otelId: data.otelId,
          odaId: data.odaId,
          cariId: cari.id,
          girisTarihi: dateOnly(data.girisTarihi),
          girisSaati: data.girisSaati || "14:00",
          cikisTarihi: dateOnly(data.cikisTarihi),
          cikisSaati: data.cikisSaati || "12:00",
          kisiSayisi: data.kisiSayisi,
          ucretTipi: data.ucretTipi,
          birimUcret: data.ucretTipi === "KISI_BASI" ? centsToDecimalString(birimCents) : null,
          toplamTutar: centsToDecimalString(toplamCents),
          durum: "BEKLEMEDE",
          not: data.not || null,
          olusturanId: permission.session.id
        },
        include: { oda: { select: { odaNo: true } }, cari: { select: { ad: true } } }
      });

      await tx.cariHareket.create({
        data: {
          otelId: data.otelId,
          cariId: cari.id,
          rezervasyonId: rezervasyon.id,
          tur: "KONAKLAMA_BORC",
          borc: centsToDecimalString(toplamCents),
          alacak: "0.00",
          aciklama: `Oda ${oda.odaNo}, ${formatDateTR(data.girisTarihi)} - ${formatDateTR(data.cikisTarihi)}, ${data.kisiSayisi} kişi`,
          olusturanId: permission.session.id
        }
      });

      if (tahsilatCents > 0 && hesap && data.odemeYontemi) {
        const tahsilat = await tx.cariHareket.create({
          data: {
            otelId: data.otelId,
            cariId: cari.id,
            rezervasyonId: rezervasyon.id,
            tur: "TAHSILAT",
            borc: "0.00",
            alacak: centsToDecimalString(tahsilatCents),
            odemeYontemi: data.odemeYontemi,
            aciklama: `Rezervasyon tahsilatı: Oda ${oda.odaNo}, ${hesap.ad}`,
            olusturanId: permission.session.id
          }
        });

        await tx.hesapHareket.create({
          data: {
            hesapId: hesap.id,
            tur: "TAHSILAT",
            tutar: centsToDecimalString(tahsilatCents),
            cariHareketId: tahsilat.id,
            aciklama: `Rezervasyon tahsilatı: ${cari.ad}`,
            olusturanId: permission.session.id
          }
        });
      }

      await tx.oda.update({
        where: { id: data.odaId },
        data: { operasyonDurumu: "REZERVE" }
      });

      await tx.islemLogu.create({
        data: {
          kullaniciId: permission.session.id,
          otelId: data.otelId,
          islemTuru: "REZERVASYON_OLUSTURMA",
          tablo: "Rezervasyon",
          kayitId: rezervasyon.id,
          yeniDeger: {
            odaId: data.odaId,
            cariId: cari.id,
            girisTarihi: data.girisTarihi,
            cikisTarihi: data.cikisTarihi,
            toplamTutar: centsToDecimalString(toplamCents),
            tahsilatTutar: centsToDecimalString(tahsilatCents)
          },
          aciklama: `Rezervasyon oluşturuldu: Oda ${oda.odaNo}, ${cari.ad}`
        }
      });

      return rezervasyon;
    });

    return NextResponse.json({ rezervasyon: result }, { status: 201 });
  } catch (error) {
    if (isReservationConflictError(error)) {
      return jsonError(conflictMessage(data.girisTarihi, data.cikisTarihi), 409);
    }
    return prismaErrorResponse(error) ?? jsonError("Rezervasyon oluşturulamadı.", 500);
  }
}
