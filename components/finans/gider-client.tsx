"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTR, formatMoneyTR } from "@/lib/faz3";
import { GIDER_KATEGORILERI, HESAP_TURU_LABELS } from "@/lib/finance";

type HotelOption = { id: number; ad: string };
type HesapOption = { id: number; ad: string; tur: "NAKIT_KASA" | "BANKA" };
type CariOption = { id: number; ad: string };
type GiderRow = {
  id: number;
  tarih: string;
  tutar: string;
  kategori: string | null;
  aciklama: string | null;
  hesap: { ad: string };
  olusturan: { adSoyad: string };
  cari: { ad: string } | null;
};

type Props = {
  hotels: HotelOption[];
  selectedHotelId: number;
  hesaplar: HesapOption[];
  cariler: CariOption[];
  giderler: GiderRow[];
};

export function GiderClient({ hotels, selectedHotelId, hesaplar, cariler, giderler }: Props) {
  const [form, setForm] = useState({
    hesapId: hesaplar[0]?.id ?? 0,
    cariId: 0,
    kategori: "Diğer",
    tutar: "",
    aciklama: ""
  });
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/finans/gider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...form, cariId: form.cariId || undefined })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Gider kaydedilemedi.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gider / Ödeme</h1>
          <p className="mt-1 text-sm text-muted">Hesaptan para çıkışı kaydet; gerekirse cariye ödeme olarak bağla.</p>
        </div>
        <form action="/finans/gider" className="flex items-center gap-2">
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
        <h2 className="text-lg font-semibold">Yeni Gider</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={save}>
          <label className="grid gap-1 text-sm">
            Kategori*
            <Select value={form.kategori} onChange={(event) => setForm({ ...form, kategori: event.target.value })}>
              {GIDER_KATEGORILERI.map((kategori) => (
                <option key={kategori} value={kategori}>
                  {kategori}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Tutar*
            <Input value={form.tutar} onChange={(event) => setForm({ ...form, tutar: event.target.value })} placeholder="750.00" required />
          </label>
          <label className="grid gap-1 text-sm">
            Hesap*
            <Select value={form.hesapId} onChange={(event) => setForm({ ...form, hesapId: Number(event.target.value) })}>
              {hesaplar.map((hesap) => (
                <option key={hesap.id} value={hesap.id}>
                  {hesap.ad} · {HESAP_TURU_LABELS[hesap.tur]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Cari (opsiyonel)
            <Select value={form.cariId} onChange={(event) => setForm({ ...form, cariId: Number(event.target.value) })}>
              <option value={0}>Cari seçme</option>
              {cariler.map((cari) => (
                <option key={cari.id} value={cari.id}>
                  {cari.ad}
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
            <Button disabled={!form.hesapId} type="submit">
              Gideri Kaydet
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Son Giderler</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Cari</th>
                <th className="px-3 py-2">Hesap</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-3 py-2">Personel</th>
              </tr>
            </thead>
            <tbody>
              {giderler.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTR(item.tarih)}</td>
                  <td className="px-3 py-2">{item.kategori ?? "-"}</td>
                  <td className="px-3 py-2">{item.cari?.ad ?? "-"}</td>
                  <td className="px-3 py-2">{item.hesap.ad}</td>
                  <td className="px-3 py-2 text-right">{formatMoneyTR(item.tutar)}</td>
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
