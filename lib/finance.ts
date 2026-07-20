import type { HesapHareketTuru, HesapTuru, OdemeYontemi } from "@prisma/client";
import { decimalToCents } from "@/lib/faz3";

export const HESAP_TURU_LABELS: Record<HesapTuru, string> = {
  NAKIT_KASA: "Nakit Kasa",
  BANKA: "Banka"
};

export const HESAP_HAREKET_TURU_LABELS: Record<HesapHareketTuru, string> = {
  TAHSILAT: "Tahsilat",
  ODEME: "Ödeme",
  GELIR: "Gelir",
  GIDER: "Gider",
  VIRMAN_GIRIS: "Virman Giriş",
  VIRMAN_CIKIS: "Virman Çıkış"
};

export const ODEME_YONTEMI_HESAP_TURU: Record<OdemeYontemi, HesapTuru> = {
  NAKIT: "NAKIT_KASA",
  HAVALE: "BANKA",
  EFT: "BANKA",
  KART: "BANKA"
};

export const GIDER_KATEGORILERI = ["Elektrik", "Su", "Personel", "Temizlik", "Bakım", "Diğer"] as const;

const hesapGirisTurleri: HesapHareketTuru[] = ["TAHSILAT", "GELIR", "VIRMAN_GIRIS"];

export function hesapHareketYon(tur: HesapHareketTuru) {
  return hesapGirisTurleri.includes(tur) ? 1 : -1;
}

export function calculateAccountBalanceCents(movements: Array<{ tur: HesapHareketTuru; tutar: string | number | { toString(): string } }>) {
  return movements.reduce((total, movement) => total + hesapHareketYon(movement.tur) * decimalToCents(movement.tutar.toString()), 0);
}

export function isValidAccountForPaymentMethod(method: OdemeYontemi, accountType: HesapTuru) {
  return ODEME_YONTEMI_HESAP_TURU[method] === accountType;
}
