"use client";

import { formatDateTR, formatMoneyTR } from "@/lib/faz3";
import { HESAP_HAREKET_TURU_LABELS, HESAP_TURU_LABELS } from "@/lib/finance";

type Hesap = {
  id: number;
  ad: string;
  tur: keyof typeof HESAP_TURU_LABELS;
  bankaAdi: string | null;
  iban: string | null;
  bakiye: string;
};

type Hareket = {
  id: number;
  tarih: string;
  tur: keyof typeof HESAP_HAREKET_TURU_LABELS;
  giris: string;
  cikis: string;
  bakiye: string;
  aciklama: string | null;
  kategori: string | null;
  olusturan: { adSoyad: string; kullaniciAdi: string };
};

type Props = {
  hesap: Hesap;
  hareketler: Hareket[];
};

export function HesapDetailClient({ hesap, hareketler }: Props) {
  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-border bg-surface p-5">
        <div className="text-sm text-muted">{HESAP_TURU_LABELS[hesap.tur]}</div>
        <h1 className="mt-1 text-2xl font-semibold">{hesap.ad}</h1>
        <div className="mt-2 text-sm text-muted">
          {[hesap.bankaAdi, hesap.iban].filter(Boolean).join(" · ") || "Kasa hesabı"}
        </div>
        <div className="mt-5 text-sm text-muted">Güncel bakiye</div>
        <div className="mt-1 text-4xl font-semibold">{formatMoneyTR(hesap.bakiye)}</div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Hesap Ekstresi</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">İşlem</th>
                <th className="px-3 py-2 text-right">Giriş</th>
                <th className="px-3 py-2 text-right">Çıkış</th>
                <th className="px-3 py-2 text-right">Bakiye</th>
                <th className="px-3 py-2">Açıklama</th>
                <th className="px-3 py-2">Personel</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((hareket) => (
                <tr key={hareket.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTR(hareket.tarih)}</td>
                  <td className="px-3 py-2">{HESAP_HAREKET_TURU_LABELS[hareket.tur]}</td>
                  <td className="px-3 py-2 text-right">{hareket.giris === "0.00" ? "-" : formatMoneyTR(hareket.giris)}</td>
                  <td className="px-3 py-2 text-right">{hareket.cikis === "0.00" ? "-" : formatMoneyTR(hareket.cikis)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoneyTR(hareket.bakiye)}</td>
                  <td className="px-3 py-2">{hareket.aciklama ?? hareket.kategori ?? "-"}</td>
                  <td className="px-3 py-2">{hareket.olusturan.adSoyad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
