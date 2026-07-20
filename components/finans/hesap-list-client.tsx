"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoneyTR } from "@/lib/faz3";
import { HESAP_TURU_LABELS } from "@/lib/finance";

type HesapRow = {
  id: number;
  tur: keyof typeof HESAP_TURU_LABELS;
  ad: string;
  bankaAdi: string | null;
  iban: string | null;
  aktifMi: boolean;
  bakiye: string;
};

type HotelOption = { id: number; ad: string };

type Props = {
  hesaplar: HesapRow[];
  hotels: HotelOption[];
  selectedHotelId: number;
  canEdit: boolean;
};

const emptyForm = {
  tur: "NAKIT_KASA" as keyof typeof HESAP_TURU_LABELS,
  ad: "",
  bankaAdi: "",
  iban: "",
  aktifMi: true
};

export function HesapListClient({ hesaplar, hotels, selectedHotelId, canEdit }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  function edit(row: HesapRow) {
    setEditingId(row.id);
    setForm({
      tur: row.tur,
      ad: row.ad,
      bankaAdi: row.bankaAdi ?? "",
      iban: row.iban ?? "",
      aktifMi: row.aktifMi
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const endpoint = editingId ? `/api/finans/hesaplar/${editingId}` : "/api/finans/hesaplar";
    const response = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...form })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Hesap kaydedilemedi.");
      return;
    }
    window.location.reload();
  }

  async function remove(id: number) {
    setMessage("");
    const response = await fetch(`/api/finans/hesaplar/${id}?otelId=${selectedHotelId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Hesap silinemedi.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Finans Hesapları</h1>
          <p className="mt-1 text-sm text-muted">Kasa ve banka hesapları, hareketlerden hesaplanan güncel bakiyeler.</p>
        </div>
        <form action="/finans/hesaplar" className="flex items-center gap-2">
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

      {message ? <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div> : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Hesap Listesi</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Ad</th>
                <th className="px-3 py-2">Tür</th>
                <th className="px-3 py-2">Banka</th>
                <th className="px-3 py-2">IBAN</th>
                <th className="px-3 py-2 text-right">Bakiye</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {hesaplar.map((hesap) => (
                <tr key={hesap.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <Link className="text-accent hover:underline" href={`/finans/hesaplar/${hesap.id}?otelId=${selectedHotelId}`}>
                      {hesap.ad}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{HESAP_TURU_LABELS[hesap.tur]}</td>
                  <td className="px-3 py-2">{hesap.bankaAdi ?? "-"}</td>
                  <td className="px-3 py-2">{hesap.iban ?? "-"}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoneyTR(hesap.bakiye)}</td>
                  <td className="px-3 py-2">{hesap.aktifMi ? "Aktif" : "Pasif"}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <div className="flex gap-2">
                        <button className="text-accent hover:underline" type="button" onClick={() => edit(hesap)}>
                          Düzenle
                        </button>
                        <button className="text-danger hover:underline" type="button" onClick={() => remove(hesap.id)}>
                          Sil
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">{editingId ? "Hesap Düzenle" : "Yeni Hesap"}</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={save}>
            <label className="grid gap-1 text-sm">
              Tür*
              <Select value={form.tur} onChange={(event) => setForm({ ...form, tur: event.target.value as keyof typeof HESAP_TURU_LABELS })}>
                <option value="NAKIT_KASA">Nakit Kasa</option>
                <option value="BANKA">Banka</option>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              Ad*
              <Input value={form.ad} onChange={(event) => setForm({ ...form, ad: event.target.value })} required />
            </label>
            {form.tur === "BANKA" ? (
              <>
                <label className="grid gap-1 text-sm">
                  Banka Adı
                  <Input value={form.bankaAdi} onChange={(event) => setForm({ ...form, bankaAdi: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm">
                  IBAN
                  <Input value={form.iban} onChange={(event) => setForm({ ...form, iban: event.target.value })} />
                </label>
              </>
            ) : null}
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input checked={form.aktifMi} onChange={(event) => setForm({ ...form, aktifMi: event.target.checked })} type="checkbox" />
              Aktif
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">{editingId ? "Güncelle" : "Kaydet"}</Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Vazgeç
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
