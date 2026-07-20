"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTR, formatMoneyTR } from "@/lib/faz3";
import { HESAP_TURU_LABELS } from "@/lib/finance";

type HotelOption = { id: number; ad: string };
type HesapOption = { id: number; ad: string; tur: "NAKIT_KASA" | "BANKA" };
type VirmanRow = {
  id: number;
  tarih: string;
  tutar: string;
  aciklama: string | null;
  hesap: { ad: string };
  karsiHesap: { ad: string } | null;
  olusturan: { adSoyad: string };
};

type Props = {
  hotels: HotelOption[];
  selectedHotelId: number;
  hesaplar: HesapOption[];
  virmanlar: VirmanRow[];
};

export function VirmanClient({ hotels, selectedHotelId, hesaplar, virmanlar }: Props) {
  const [form, setForm] = useState({
    kaynakHesapId: hesaplar[0]?.id ?? 0,
    hedefHesapId: hesaplar[1]?.id ?? 0,
    tutar: "",
    aciklama: ""
  });
  const [message, setMessage] = useState("");
  const targetAccounts = useMemo(() => hesaplar.filter((hesap) => hesap.id !== form.kaynakHesapId), [form.kaynakHesapId, hesaplar]);
  const hedefHesapId = form.hedefHesapId && form.hedefHesapId !== form.kaynakHesapId ? form.hedefHesapId : targetAccounts[0]?.id ?? 0;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/finans/virman", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...form, hedefHesapId })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Virman kaydedilemedi.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Virman</h1>
          <p className="mt-1 text-sm text-muted">Kasa ve banka hesapları arasında para aktarımı.</p>
        </div>
        <form action="/finans/virman" className="flex items-center gap-2">
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
        <h2 className="text-lg font-semibold">Yeni Virman</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={save}>
          <label className="grid gap-1 text-sm">
            Kaynak Hesap*
            <Select value={form.kaynakHesapId} onChange={(event) => setForm({ ...form, kaynakHesapId: Number(event.target.value), hedefHesapId: 0 })}>
              {hesaplar.map((hesap) => (
                <option key={hesap.id} value={hesap.id}>
                  {hesap.ad} · {HESAP_TURU_LABELS[hesap.tur]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Hedef Hesap*
            <Select value={hedefHesapId} onChange={(event) => setForm({ ...form, hedefHesapId: Number(event.target.value) })}>
              {targetAccounts.map((hesap) => (
                <option key={hesap.id} value={hesap.id}>
                  {hesap.ad} · {HESAP_TURU_LABELS[hesap.tur]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Tutar*
            <Input value={form.tutar} onChange={(event) => setForm({ ...form, tutar: event.target.value })} placeholder="1000.00" required />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Açıklama
            <Textarea value={form.aciklama} onChange={(event) => setForm({ ...form, aciklama: event.target.value })} />
          </label>
          {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger md:col-span-2">{message}</div> : null}
          <div className="md:col-span-2">
            <Button disabled={!form.kaynakHesapId || !hedefHesapId || hesaplar.length < 2} type="submit">
              Virmanı Kaydet
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Son Virmanlar</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Kaynak</th>
                <th className="px-3 py-2">Hedef</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-3 py-2">Personel</th>
              </tr>
            </thead>
            <tbody>
              {virmanlar.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTR(item.tarih)}</td>
                  <td className="px-3 py-2">{item.hesap.ad}</td>
                  <td className="px-3 py-2">{item.karsiHesap?.ad ?? "-"}</td>
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
