"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ODEME_YONTEMI_LABELS, formatDateTR, formatMoneyTR } from "@/lib/faz3";
import { HESAP_TURU_LABELS, ODEME_YONTEMI_HESAP_TURU } from "@/lib/finance";

type CariOption = { id: number; ad: string; bakiye: string };
type HesapOption = { id: number; ad: string; tur: "NAKIT_KASA" | "BANKA" };
type HotelOption = { id: number; ad: string };
type TahsilatRow = {
  id: number;
  tarih: string;
  alacak: string;
  odemeYontemi: keyof typeof ODEME_YONTEMI_LABELS | null;
  aciklama: string | null;
  cari: { ad: string };
  olusturan: { adSoyad: string; kullaniciAdi: string };
  hesapAdi: string;
};

type Props = {
  hotels: HotelOption[];
  selectedHotelId: number;
  cariler: CariOption[];
  hesaplar: HesapOption[];
  tahsilatlar: TahsilatRow[];
};

export function TahsilatClient({ hotels, selectedHotelId, cariler, hesaplar, tahsilatlar }: Props) {
  const [form, setForm] = useState({
    cariId: cariler[0]?.id ?? 0,
    tutar: "",
    odemeYontemi: "NAKIT" as keyof typeof ODEME_YONTEMI_LABELS,
    hesapId: 0,
    aciklama: ""
  });
  const [message, setMessage] = useState("");
  const selectedCari = cariler.find((cari) => cari.id === form.cariId);
  const filteredAccounts = useMemo(
    () => hesaplar.filter((hesap) => hesap.tur === ODEME_YONTEMI_HESAP_TURU[form.odemeYontemi]),
    [form.odemeYontemi, hesaplar]
  );
  const hesapId = form.hesapId || filteredAccounts[0]?.id || 0;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/finans/tahsilat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...form, hesapId })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Tahsilat kaydedilemedi.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tahsilat</h1>
          <p className="mt-1 text-sm text-muted">Cariden para al, cari bakiyesini düşür ve seçilen hesabın bakiyesini artır.</p>
        </div>
        <form action="/finans/tahsilat" className="flex items-center gap-2">
          <Select name="otelId" defaultValue={selectedHotelId}>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.ad}
              </option>
            ))}
          </Select>
          <Button type="submit">Seç</Button>
        </form>
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Yeni Tahsilat</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={save}>
          <label className="grid gap-1 text-sm">
            Cari*
            <Select value={form.cariId} onChange={(event) => setForm({ ...form, cariId: Number(event.target.value) })}>
              {cariler.map((cari) => (
                <option key={cari.id} value={cari.id}>
                  {cari.ad}
                </option>
              ))}
            </Select>
          </label>
          <div className="rounded-md border border-border bg-white px-3 py-2 text-sm">
            Mevcut bakiye
            <div className="mt-1 font-medium">{formatMoneyTR(selectedCari?.bakiye ?? "0")}</div>
          </div>
          <label className="grid gap-1 text-sm">
            Tutar*
            <Input value={form.tutar} onChange={(event) => setForm({ ...form, tutar: event.target.value })} placeholder="2500.00" required />
          </label>
          <label className="grid gap-1 text-sm">
            Ödeme Yöntemi*
            <Select
              value={form.odemeYontemi}
              onChange={(event) => setForm({ ...form, odemeYontemi: event.target.value as keyof typeof ODEME_YONTEMI_LABELS, hesapId: 0 })}
            >
              {Object.entries(ODEME_YONTEMI_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Hesap*
            <Select value={hesapId} onChange={(event) => setForm({ ...form, hesapId: Number(event.target.value) })}>
              {filteredAccounts.map((hesap) => (
                <option key={hesap.id} value={hesap.id}>
                  {hesap.ad} · {HESAP_TURU_LABELS[hesap.tur]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Açıklama
            <Textarea value={form.aciklama} onChange={(event) => setForm({ ...form, aciklama: event.target.value })} />
          </label>
          {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger md:col-span-2">{message}</div> : null}
          <div className="md:col-span-2">
            <Button disabled={!form.cariId || !hesapId} type="submit">
              Tahsilatı Kaydet
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Son Tahsilatlar</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Cari</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-3 py-2">Yöntem</th>
                <th className="px-3 py-2">Hesap</th>
                <th className="px-3 py-2">Personel</th>
              </tr>
            </thead>
            <tbody>
              {tahsilatlar.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTR(item.tarih)}</td>
                  <td className="px-3 py-2">{item.cari.ad}</td>
                  <td className="px-3 py-2 text-right">{formatMoneyTR(item.alacak)}</td>
                  <td className="px-3 py-2">{item.odemeYontemi ? ODEME_YONTEMI_LABELS[item.odemeYontemi] : "-"}</td>
                  <td className="px-3 py-2">{item.hesapAdi}</td>
                  <td className="px-3 py-2">{item.olusturan.adSoyad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
