-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PERSONEL');

-- CreateEnum
CREATE TYPE "YetkiSeviyesiRezervasyon" AS ENUM ('YOK', 'GORUNTULE', 'EKLE', 'TAM');

-- CreateEnum
CREATE TYPE "YetkiSeviyesiCari" AS ENUM ('YOK', 'GORUNTULE', 'TAHSILAT', 'TAM');

-- CreateEnum
CREATE TYPE "YetkiSeviyesiFinans" AS ENUM ('YOK', 'GORUNTULE', 'SINIRLI', 'TAM');

-- CreateEnum
CREATE TYPE "YetkiSeviyesiRapor" AS ENUM ('YOK', 'GORUNTULE', 'TAM');

-- CreateEnum
CREATE TYPE "CariTur" AS ENUM ('TUR_SIRKETI', 'ACENTE', 'KURUMSAL', 'TEDARIKCI', 'BIREYSEL');

-- CreateEnum
CREATE TYPE "OdaOperasyonDurumu" AS ENUM ('BOS', 'DOLU', 'REZERVE', 'BAKIM', 'TEMIZLIK');

-- CreateEnum
CREATE TYPE "RezervasyonDurumu" AS ENUM ('BEKLEMEDE', 'ONAYLANDI', 'GIRIS_YAPILDI', 'CIKIS_YAPILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "UcretTipi" AS ENUM ('TOPLAM', 'KISI_BASI');

-- CreateEnum
CREATE TYPE "HesapTuru" AS ENUM ('NAKIT_KASA', 'BANKA');

-- CreateEnum
CREATE TYPE "CariHareketTuru" AS ENUM ('KONAKLAMA_BORC', 'TAHSILAT', 'ODEME', 'DUZELTME');

-- CreateEnum
CREATE TYPE "HesapHareketTuru" AS ENUM ('TAHSILAT', 'ODEME', 'GELIR', 'GIDER', 'VIRMAN_GIRIS', 'VIRMAN_CIKIS');

-- CreateEnum
CREATE TYPE "OdemeYontemi" AS ENUM ('NAKIT', 'HAVALE', 'EFT', 'KART');

-- CreateEnum
CREATE TYPE "IletisimTuru" AS ENUM ('ARANDI', 'ULASILAMADI', 'GERI_DONUS_BEKLENIYOR', 'WHATSAPP', 'NOT');

-- CreateEnum
CREATE TYPE "OnayTuru" AS ENUM ('GECMIS_TARIH_DUZELTME', 'KISI_SAYISI_DEGISIKLIGI', 'CARI_BAKIYE_DUZELTME', 'TAHSILAT_IPTAL', 'GIDER_IPTAL', 'REZERVASYON_SILME');

-- CreateEnum
CREATE TYPE "OnayDurumu" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- CreateTable
CREATE TABLE "Sirket" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sirket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otel" (
    "id" SERIAL NOT NULL,
    "sirketId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "adres" TEXT,
    "telefon" TEXT,
    "eposta" TEXT,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Otel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kat" (
    "id" SERIAL NOT NULL,
    "otelId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Kat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oda" (
    "id" SERIAL NOT NULL,
    "otelId" INTEGER NOT NULL,
    "katId" INTEGER NOT NULL,
    "odaNo" TEXT NOT NULL,
    "odaTipi" TEXT,
    "kapasite" INTEGER NOT NULL,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "operasyonDurumu" "OdaOperasyonDurumu" NOT NULL DEFAULT 'BOS',
    "aciklama" TEXT,
    "krokiX" DOUBLE PRECISION,
    "krokiY" DOUBLE PRECISION,
    "krokiGenislik" DOUBLE PRECISION,
    "krokiYukseklik" DOUBLE PRECISION,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kroki" (
    "id" SERIAL NOT NULL,
    "otelId" INTEGER NOT NULL,
    "katId" INTEGER,
    "ad" TEXT NOT NULL,
    "svgVeri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kroki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" SERIAL NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "kullaniciAdi" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'PERSONEL',
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KullaniciOtelYetkisi" (
    "id" SERIAL NOT NULL,
    "kullaniciId" INTEGER NOT NULL,
    "otelId" INTEGER NOT NULL,
    "rezervasyonYetkisi" "YetkiSeviyesiRezervasyon" NOT NULL DEFAULT 'YOK',
    "cariYetkisi" "YetkiSeviyesiCari" NOT NULL DEFAULT 'YOK',
    "finansYetkisi" "YetkiSeviyesiFinans" NOT NULL DEFAULT 'YOK',
    "raporYetkisi" "YetkiSeviyesiRapor" NOT NULL DEFAULT 'YOK',

    CONSTRAINT "KullaniciOtelYetkisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cari" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "tur" "CariTur" NOT NULL,
    "vergiNo" TEXT,
    "vergiDairesi" TEXT,
    "adres" TEXT,
    "telefon" TEXT,
    "whatsapp" TEXT,
    "eposta" TEXT,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariYetkili" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "gorev" TEXT,
    "telefon" TEXT,
    "whatsapp" TEXT,
    "eposta" TEXT,

    CONSTRAINT "CariYetkili_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IletisimKaydi" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "kullaniciId" INTEGER NOT NULL,
    "tarihSaat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "IletisimTuru" NOT NULL,
    "aciklama" TEXT,

    CONSTRAINT "IletisimKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rezervasyon" (
    "id" SERIAL NOT NULL,
    "otelId" INTEGER NOT NULL,
    "odaId" INTEGER NOT NULL,
    "cariId" INTEGER NOT NULL,
    "girisTarihi" DATE NOT NULL,
    "girisSaati" TEXT NOT NULL DEFAULT '14:00',
    "cikisTarihi" DATE NOT NULL,
    "cikisSaati" TEXT NOT NULL DEFAULT '12:00',
    "kisiSayisi" INTEGER NOT NULL,
    "ucretTipi" "UcretTipi" NOT NULL DEFAULT 'TOPLAM',
    "birimUcret" DECIMAL(14,2),
    "toplamTutar" DECIMAL(14,2) NOT NULL,
    "durum" "RezervasyonDurumu" NOT NULL DEFAULT 'BEKLEMEDE',
    "not" TEXT,
    "olusturanId" INTEGER NOT NULL,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rezervasyon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hesap" (
    "id" SERIAL NOT NULL,
    "otelId" INTEGER NOT NULL,
    "tur" "HesapTuru" NOT NULL,
    "ad" TEXT NOT NULL,
    "bankaAdi" TEXT,
    "iban" TEXT,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hesap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariHareket" (
    "id" SERIAL NOT NULL,
    "otelId" INTEGER NOT NULL,
    "cariId" INTEGER NOT NULL,
    "rezervasyonId" INTEGER,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "CariHareketTuru" NOT NULL,
    "borc" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "alacak" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "odemeYontemi" "OdemeYontemi",
    "aciklama" TEXT,
    "olusturanId" INTEGER NOT NULL,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CariHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HesapHareket" (
    "id" SERIAL NOT NULL,
    "hesapId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "HesapHareketTuru" NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "karsiHesapId" INTEGER,
    "cariHareketId" INTEGER,
    "kategori" TEXT,
    "aciklama" TEXT,
    "olusturanId" INTEGER NOT NULL,
    "silindiMi" BOOLEAN NOT NULL DEFAULT false,
    "silinmeTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HesapHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslemLogu" (
    "id" SERIAL NOT NULL,
    "kullaniciId" INTEGER NOT NULL,
    "otelId" INTEGER,
    "tarihSaat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "islemTuru" TEXT NOT NULL,
    "tablo" TEXT NOT NULL,
    "kayitId" INTEGER NOT NULL,
    "oncekiDeger" JSONB,
    "yeniDeger" JSONB,
    "aciklama" TEXT,

    CONSTRAINT "IslemLogu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnayTalebi" (
    "id" SERIAL NOT NULL,
    "talepEdenId" INTEGER NOT NULL,
    "otelId" INTEGER NOT NULL,
    "tur" "OnayTuru" NOT NULL,
    "hedefTablo" TEXT NOT NULL,
    "hedefKayitId" INTEGER NOT NULL,
    "istenenDegisiklik" JSONB NOT NULL,
    "durum" "OnayDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "kararVerenId" INTEGER,
    "kararTarihi" TIMESTAMP(3),
    "kararAciklamasi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnayTalebi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kat_otelId_ad_key" ON "Kat"("otelId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "Oda_otelId_odaNo_key" ON "Oda"("otelId", "odaNo");

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_kullaniciAdi_key" ON "Kullanici"("kullaniciAdi");

-- CreateIndex
CREATE UNIQUE INDEX "KullaniciOtelYetkisi_kullaniciId_otelId_key" ON "KullaniciOtelYetkisi"("kullaniciId", "otelId");

-- CreateIndex
CREATE INDEX "Rezervasyon_otelId_girisTarihi_cikisTarihi_idx" ON "Rezervasyon"("otelId", "girisTarihi", "cikisTarihi");

-- CreateIndex
CREATE INDEX "Rezervasyon_cariId_idx" ON "Rezervasyon"("cariId");

-- CreateIndex
CREATE UNIQUE INDEX "Hesap_otelId_ad_key" ON "Hesap"("otelId", "ad");

-- CreateIndex
CREATE INDEX "CariHareket_cariId_tarih_idx" ON "CariHareket"("cariId", "tarih");

-- CreateIndex
CREATE INDEX "CariHareket_otelId_tarih_idx" ON "CariHareket"("otelId", "tarih");

-- CreateIndex
CREATE INDEX "HesapHareket_hesapId_tarih_idx" ON "HesapHareket"("hesapId", "tarih");

-- CreateIndex
CREATE INDEX "IslemLogu_otelId_tarihSaat_idx" ON "IslemLogu"("otelId", "tarihSaat");

-- CreateIndex
CREATE INDEX "IslemLogu_kullaniciId_tarihSaat_idx" ON "IslemLogu"("kullaniciId", "tarihSaat");

-- CreateIndex
CREATE INDEX "OnayTalebi_otelId_durum_idx" ON "OnayTalebi"("otelId", "durum");

-- AddForeignKey
ALTER TABLE "Otel" ADD CONSTRAINT "Otel_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kat" ADD CONSTRAINT "Kat_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oda" ADD CONSTRAINT "Oda_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oda" ADD CONSTRAINT "Oda_katId_fkey" FOREIGN KEY ("katId") REFERENCES "Kat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kroki" ADD CONSTRAINT "Kroki_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciOtelYetkisi" ADD CONSTRAINT "KullaniciOtelYetkisi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciOtelYetkisi" ADD CONSTRAINT "KullaniciOtelYetkisi_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariYetkili" ADD CONSTRAINT "CariYetkili_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IletisimKaydi" ADD CONSTRAINT "IletisimKaydi_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IletisimKaydi" ADD CONSTRAINT "IletisimKaydi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rezervasyon" ADD CONSTRAINT "Rezervasyon_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rezervasyon" ADD CONSTRAINT "Rezervasyon_odaId_fkey" FOREIGN KEY ("odaId") REFERENCES "Oda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rezervasyon" ADD CONSTRAINT "Rezervasyon_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rezervasyon" ADD CONSTRAINT "Rezervasyon_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hesap" ADD CONSTRAINT "Hesap_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_rezervasyonId_fkey" FOREIGN KEY ("rezervasyonId") REFERENCES "Rezervasyon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareket" ADD CONSTRAINT "HesapHareket_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "Hesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareket" ADD CONSTRAINT "HesapHareket_karsiHesapId_fkey" FOREIGN KEY ("karsiHesapId") REFERENCES "Hesap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareket" ADD CONSTRAINT "HesapHareket_cariHareketId_fkey" FOREIGN KEY ("cariHareketId") REFERENCES "CariHareket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareket" ADD CONSTRAINT "HesapHareket_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslemLogu" ADD CONSTRAINT "IslemLogu_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslemLogu" ADD CONSTRAINT "IslemLogu_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnayTalebi" ADD CONSTRAINT "OnayTalebi_talepEdenId_fkey" FOREIGN KEY ("talepEdenId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnayTalebi" ADD CONSTRAINT "OnayTalebi_otelId_fkey" FOREIGN KEY ("otelId") REFERENCES "Otel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnayTalebi" ADD CONSTRAINT "OnayTalebi_kararVerenId_fkey" FOREIGN KEY ("kararVerenId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Raw SQL: Rezervasyon çakışma engeli
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Rezervasyon"
  ADD COLUMN tarih_araligi daterange
  GENERATED ALWAYS AS (daterange("girisTarihi", "cikisTarihi", '[)')) STORED;

ALTER TABLE "Rezervasyon"
  ADD CONSTRAINT rezervasyon_cakisma_engeli
  EXCLUDE USING gist (
    "odaId" WITH =,
    tarih_araligi WITH &&
  )
  WHERE (durum <> 'IPTAL' AND "silindiMi" = false);

