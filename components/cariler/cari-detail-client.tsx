"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CARI_TUR_LABELS,
  ILETISIM_TUR_LABELS,
  REZERVASYON_DURUM_LABELS,
  centsToDecimalString,
  decimalToCents,
  formatDateTR,
  formatMoneyTR,
  normalizePhoneForWaMe
} from "@/lib/faz3";

type CariDetail = {
  id: number;
  ad: string;
  tur: keyof typeof CARI_TUR_LABELS;
  vergiNo: string | null;
  vergiDairesi: string | null;
  adres: string | null;
  telefon: string | null;
  whatsapp: string | null;
  eposta: string | null;
  aktifMi: boolean;
  bakiye: string;
  yetkililer: Array<{ id: number; adSoyad: string; gorev: string | null; telefon: string | null; whatsapp: string | null; eposta: string | null }>;
  iletisimKayitlari: Array<{ id: number; tarihSaat: string; tur: keyof typeof ILETISIM_TUR_LABELS; aciklama: string | null; kullanici: { adSoyad: string } }>;
  hareketler: Array<{
    id: number;
    tarih: string;
    tur: string;
    borc: string;
    alacak: string;
    aciklama: string | null;
    otel: { ad: string };
    rezervasyon: { kisiSayisi: number; oda: { odaNo: string } } | null;
  }>;
  rezervasyonlar: Array<{
    id: number;
    otel: { ad: string };
    oda: { odaNo: string };
    girisTarihi: string;
    cikisTarihi: string;
    kisiSayisi: number;
    toplamTutar: string;
    durum: keyof typeof REZERVASYON_DURUM_LABELS;
  }>;
};

type CariDetailClientProps = {
  cari: CariDetail;
  selectedHotelId: number;
  canEdit: boolean;
};

export function CariDetailClient({ cari, selectedHotelId, canEdit }: CariDetailClientProps) {
  const [form, setForm] = useState({
    ad: cari.ad,
    tur: cari.tur,
    vergiNo: cari.vergiNo ?? "",
    vergiDairesi: cari.vergiDairesi ?? "",
    adres: cari.adres ?? "",
    telefon: cari.telefon ?? "",
    whatsapp: cari.whatsapp ?? "",
    eposta: cari.eposta ?? "",
    aktifMi: cari.aktifMi
  });
  const [yetkili, setYetkili] = useState({ adSoyad: "", gorev: "", telefon: "", whatsapp: "", eposta: "" });
  const [iletisim, setIletisim] = useState({ tur: "ARANDI", aciklama: "" });
  const [message, setMessage] = useState("");

  async function updateCari(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/cariler/${cari.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...form })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Cari güncellenemedi.");
      return;
    }
    window.location.reload();
  }

  async function deleteCari() {
    const response = await fetch(`/api/cariler/${cari.id}?otelId=${selectedHotelId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Cari silinemedi.");
      return;
    }
    window.location.href = `/cariler?otelId=${selectedHotelId}`;
  }

  async function addYetkili(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/cariler/${cari.id}/yetkililer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...yetkili })
    });
    if (response.ok) window.location.reload();
  }

  async function removeYetkili(id: number) {
    const response = await fetch(`/api/cariler/${cari.id}/yetkililer/${id}?otelId=${selectedHotelId}`, { method: "DELETE" });
    if (response.ok) window.location.reload();
  }

  async function addIletisim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/cariler/${cari.id}/iletisim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...iletisim })
    });
    if (response.ok) window.location.reload();
  }

  let runningBalanceCents = 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{cari.ad}</h1>
          <p className="mt-1 text-sm text-muted">
            {CARI_TUR_LABELS[cari.tur]} · Bakiye: <span className="font-medium text-foreground">{formatMoneyTR(cari.bakiye)}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {cari.telefon ? (
              <a className="rounded-md border border-border px-3 py-2" href={`tel:${cari.telefon}`}>
                Ara
              </a>
            ) : null}
            {cari.whatsapp ? (
              <a
                className="rounded-md border border-border px-3 py-2"
                href={`https://wa.me/${normalizePhoneForWaMe(cari.whatsapp)}`}
                rel="noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <Button variant="danger" type="button" onClick={deleteCari}>
            Sil
          </Button>
        ) : null}
      </div>

      {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{message}</div> : null}

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Cari Bilgileri</h2>
        <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={updateCari}>
          <label className="grid gap-1 text-sm">
            Ad
            <Input disabled={!canEdit} value={form.ad} onChange={(event) => setForm({ ...form, ad: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            Tür
            <Select disabled={!canEdit} value={form.tur} onChange={(event) => setForm({ ...form, tur: event.target.value as any })}>
              {Object.entries(CARI_TUR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Telefon
            <Input disabled={!canEdit} value={form.telefon} onChange={(event) => setForm({ ...form, telefon: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            WhatsApp
            <Input disabled={!canEdit} value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            E-posta
            <Input disabled={!canEdit} value={form.eposta} onChange={(event) => setForm({ ...form, eposta: event.target.value })} />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input disabled={!canEdit} checked={form.aktifMi} onChange={(event) => setForm({ ...form, aktifMi: event.target.checked })} type="checkbox" />
            Aktif
          </label>
          <label className="col-span-2 grid gap-1 text-sm">
            Adres
            <Textarea disabled={!canEdit} value={form.adres} onChange={(event) => setForm({ ...form, adres: event.target.value })} />
          </label>
          {canEdit ? (
            <div className="col-span-2">
              <Button type="submit">Kaydet</Button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="grid gap-4 rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Yetkililer</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Ad Soyad</th>
                <th className="px-3 py-2">Görev</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">E-posta</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {cari.yetkililer.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">{item.adSoyad}</td>
                  <td className="px-3 py-2">{item.gorev ?? "-"}</td>
                  <td className="px-3 py-2">{item.telefon ?? "-"}</td>
                  <td className="px-3 py-2">{item.whatsapp ?? "-"}</td>
                  <td className="px-3 py-2">{item.eposta ?? "-"}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <button className="text-danger hover:underline" type="button" onClick={() => removeYetkili(item.id)}>
                        Sil
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <form className="grid grid-cols-5 gap-2" onSubmit={addYetkili}>
            <Input placeholder="Ad soyad" value={yetkili.adSoyad} onChange={(event) => setYetkili({ ...yetkili, adSoyad: event.target.value })} required />
            <Input placeholder="Görev" value={yetkili.gorev} onChange={(event) => setYetkili({ ...yetkili, gorev: event.target.value })} />
            <Input placeholder="Telefon" value={yetkili.telefon} onChange={(event) => setYetkili({ ...yetkili, telefon: event.target.value })} />
            <Input placeholder="WhatsApp" value={yetkili.whatsapp} onChange={(event) => setYetkili({ ...yetkili, whatsapp: event.target.value })} />
            <Button type="submit">Ekle</Button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">İletişim Geçmişi</h2>
        <form className="grid grid-cols-[220px_1fr_auto] gap-2" onSubmit={addIletisim}>
          <Select value={iletisim.tur} onChange={(event) => setIletisim({ ...iletisim, tur: event.target.value })}>
            {Object.entries(ILETISIM_TUR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input placeholder="Açıklama" value={iletisim.aciklama} onChange={(event) => setIletisim({ ...iletisim, aciklama: event.target.value })} />
          <Button type="submit">Not Ekle</Button>
        </form>
        <div className="grid gap-2">
          {cari.iletisimKayitlari.map((item) => (
            <div key={item.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="font-medium">
                {formatDateTR(item.tarihSaat)} · {item.kullanici.adSoyad} · {ILETISIM_TUR_LABELS[item.tur]}
              </div>
              <div className="mt-1 text-muted">{item.aciklama ?? "-"}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Cari Ekstre</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Otel/Oda</th>
                <th className="px-3 py-2">Kişi</th>
                <th className="px-3 py-2">İşlem</th>
                <th className="px-3 py-2 text-right">Borç</th>
                <th className="px-3 py-2 text-right">Alacak</th>
                <th className="px-3 py-2 text-right">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {cari.hareketler.map((item) => {
                runningBalanceCents += decimalToCents(item.borc) - decimalToCents(item.alacak);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2">{formatDateTR(item.tarih)}</td>
                    <td className="px-3 py-2">
                      {item.otel.ad}
                      {item.rezervasyon ? ` / ${item.rezervasyon.oda.odaNo}` : ""}
                    </td>
                    <td className="px-3 py-2">{item.rezervasyon?.kisiSayisi ?? "-"}</td>
                    <td className="px-3 py-2">{item.aciklama ?? item.tur}</td>
                    <td className="px-3 py-2 text-right">{formatMoneyTR(item.borc)}</td>
                    <td className="px-3 py-2 text-right">{formatMoneyTR(item.alacak)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoneyTR(centsToDecimalString(runningBalanceCents))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Rezervasyonlar</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Otel</th>
                <th className="px-3 py-2">Oda</th>
                <th className="px-3 py-2">Giriş</th>
                <th className="px-3 py-2">Çıkış</th>
                <th className="px-3 py-2">Kişi</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {cari.rezervasyonlar.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">{item.otel.ad}</td>
                  <td className="px-3 py-2">{item.oda.odaNo}</td>
                  <td className="px-3 py-2">{formatDateTR(item.girisTarihi)}</td>
                  <td className="px-3 py-2">{formatDateTR(item.cikisTarihi)}</td>
                  <td className="px-3 py-2">{item.kisiSayisi}</td>
                  <td className="px-3 py-2 text-right">{formatMoneyTR(item.toplamTutar)}</td>
                  <td className="px-3 py-2">{REZERVASYON_DURUM_LABELS[item.durum]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
