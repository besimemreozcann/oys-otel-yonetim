import { centsToDecimalString, dateOnly, decimalToCents } from "@/lib/faz3";
import { calculateAccountBalanceCents, hesapHareketYon } from "@/lib/finance";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { searchParams } = new URL(request.url);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Hesap");
  const otelId = intParam(searchParams.get("otelId"), "Otel");

  const permission = await requireApiHotelPermission(otelId, "finans", "GORUNTULE");
  if (permission.error) return permission.error;

  const baslangic = searchParams.get("baslangic");
  const bitis = searchParams.get("bitis");
  const tur = searchParams.get("tur");

  const hesap = await prisma.hesap.findFirst({
    where: { id, otelId, silindiMi: false },
    include: {
      hareketler: {
        where: { silindiMi: false },
        select: { tur: true, tutar: true }
      }
    }
  });
  if (!hesap) return jsonError("Hesap bulunamadı.", 404);

  const hareketler = await prisma.hesapHareket.findMany({
    where: {
      hesapId: id,
      silindiMi: false,
      ...(baslangic ? { tarih: { gte: dateOnly(baslangic) } } : {}),
      ...(bitis ? { tarih: { lte: dateOnly(bitis) } } : {}),
      ...(tur ? { tur: tur as any } : {})
    },
    include: {
      olusturan: { select: { adSoyad: true, kullaniciAdi: true } },
      cariHareket: { include: { cari: { select: { ad: true } } } },
      karsiHesap: { select: { ad: true } }
    },
    orderBy: { tarih: "asc" }
  });

  let runningBalanceCents = 0;
  const rows = hareketler.map((hareket) => {
    runningBalanceCents += hesapHareketYon(hareket.tur) * decimalToCents(hareket.tutar);
    return {
      id: hareket.id,
      tarih: hareket.tarih,
      tur: hareket.tur,
      tutar: hareket.tutar,
      bakiye: centsToDecimalString(runningBalanceCents),
      aciklama: hareket.aciklama,
      kategori: hareket.kategori,
      olusturan: hareket.olusturan,
      cari: hareket.cariHareket?.cari ?? null,
      karsiHesap: hareket.karsiHesap
    };
  });

  return Response.json({
    hesap: {
      id: hesap.id,
      ad: hesap.ad,
      tur: hesap.tur,
      bankaAdi: hesap.bankaAdi,
      iban: hesap.iban,
      aktifMi: hesap.aktifMi,
      bakiye: centsToDecimalString(calculateAccountBalanceCents(hesap.hareketler))
    },
    hareketler: rows
  });
}
