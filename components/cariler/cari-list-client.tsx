"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CARI_TUR_LABELS, formatMoneyTR } from "@/lib/faz3";

type CariRow = {
  id: number;
  ad: string;
  tur: keyof typeof CARI_TUR_LABELS;
  telefon: string | null;
  whatsapp: string | null;
  eposta: string | null;
  aktifMi: boolean;
  bakiye: string;
  sonHareketTarihi: string | null;
};

type HotelOption = {
  id: number;
  ad: string;
};

type CariListClientProps = {
  cariler: CariRow[];
  hotels: HotelOption[];
  selectedHotelId: number;
  canEdit: boolean;
};

const emptyForm = {
  ad: "",
  tur: "TUR_SIRKETI",
  vergiNo: "",
  vergiDairesi: "",
  adres: "",
  telefon: "",
  whatsapp: "",
  eposta: "",
  aktifMi: true
};

export function CariListClient({ cariler, hotels, selectedHotelId, canEdit }: CariListClientProps) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [turFilter, setTurFilter] = useState("");
  const [aktifFilter, setAktifFilter] = useState("");

  const filtered = useMemo(
    () =>
      cariler.filter((cari) => {
        if (turFilter && cari.tur !== turFilter) return false;
        if (aktifFilter === "true" && !cari.aktifMi) return false;
        if (aktifFilter === "false" && cari.aktifMi) return false;
        return true;
      }),
    [aktifFilter, cariler, turFilter]
  );

  const columns = useMemo<ColumnDef<CariRow>[]>(
    () => [
      {
        accessorKey: "ad",
        header: "Ad",
        cell: ({ row }) => (
          <Link className="font-medium text-accent hover:underline" href={`/cariler/${row.original.id}?otelId=${selectedHotelId}`}>
            {row.original.ad}
          </Link>
        )
      },
      { accessorKey: "tur", header: "Tür", cell: ({ row }) => CARI_TUR_LABELS[row.original.tur] },
      { accessorKey: "telefon", header: "Telefon", cell: ({ row }) => row.original.telefon ?? "-" },
      { accessorKey: "whatsapp", header: "WhatsApp", cell: ({ row }) => row.original.whatsapp ?? "-" },
      {
        accessorKey: "bakiye",
        header: "Toplam Borç",
        cell: ({ row }) => <div className="text-right font-medium">{formatMoneyTR(row.original.bakiye)}</div>
      },
      {
        accessorKey: "sonHareketTarihi",
        header: "Son Hareket",
        cell: ({ row }) =>
          row.original.sonHareketTarihi
            ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(row.original.sonHareketTarihi))
            : "-"
      },
      { accessorKey: "aktifMi", header: "Durum", cell: ({ row }) => (row.original.aktifMi ? "Aktif" : "Pasif") }
    ],
    [selectedHotelId]
  );

  async function createCari(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/cariler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otelId: selectedHotelId, ...form })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Cari oluşturulamadı.");
      return;
    }
    setForm(emptyForm);
    window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cariler</h1>
          <p className="mt-1 text-sm text-muted">Cari kartlar, yetkililer ve konaklama borçları.</p>
        </div>
        <form action="/cariler" className="flex items-center gap-2">
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

      <section className="grid gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="grid gap-1 text-sm">
            Tür
            <Select value={turFilter} onChange={(event) => setTurFilter(event.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(CARI_TUR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Durum
            <Select value={aktifFilter} onChange={(event) => setAktifFilter(event.target.value)}>
              <option value="">Tümü</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </label>
        </div>
        <DataTable columns={columns} data={filtered} searchPlaceholder="Cari adı ara" />
      </section>

      {canEdit ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Yeni Cari</h2>
          <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={createCari}>
            <label className="grid gap-1 text-sm">
              Ad*
              <Input value={form.ad} onChange={(event) => setForm({ ...form, ad: event.target.value })} required />
            </label>
            <label className="grid gap-1 text-sm">
              Tür*
              <Select value={form.tur} onChange={(event) => setForm({ ...form, tur: event.target.value })}>
                {Object.entries(CARI_TUR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              Vergi No
              <Input value={form.vergiNo} onChange={(event) => setForm({ ...form, vergiNo: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              Vergi Dairesi
              <Input value={form.vergiDairesi} onChange={(event) => setForm({ ...form, vergiDairesi: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              Telefon
              <Input value={form.telefon} onChange={(event) => setForm({ ...form, telefon: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              WhatsApp
              <Input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              E-posta
              <Input type="email" value={form.eposta} onChange={(event) => setForm({ ...form, eposta: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                checked={form.aktifMi}
                onChange={(event) => setForm({ ...form, aktifMi: event.target.checked })}
                type="checkbox"
              />
              Aktif
            </label>
            <label className="col-span-2 grid gap-1 text-sm">
              Adres
              <Textarea value={form.adres} onChange={(event) => setForm({ ...form, adres: event.target.value })} />
            </label>
            {message ? <div className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{message}</div> : null}
            <div className="col-span-2">
              <Button type="submit">Yeni Cari Kaydet</Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
