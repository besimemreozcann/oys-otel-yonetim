"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { REZERVASYON_DURUM_LABELS, formatDateTR, formatMoneyTR } from "@/lib/faz3";

type RezervasyonRow = {
  id: number;
  otel: { ad: string };
  oda: { odaNo: string };
  cari: { ad: string };
  girisTarihi: string;
  cikisTarihi: string;
  kisiSayisi: number;
  toplamTutar: string;
  durum: keyof typeof REZERVASYON_DURUM_LABELS;
};

type HotelOption = { id: number; ad: string };

type Props = {
  rezervasyonlar: RezervasyonRow[];
  hotels: HotelOption[];
  selectedHotelId: number;
};

const actionsByStatus: Record<string, Array<{ label: string; value: string }>> = {
  BEKLEMEDE: [
    { label: "Onayla", value: "ONAYLA" },
    { label: "İptal", value: "IPTAL" }
  ],
  ONAYLANDI: [
    { label: "Giriş Yap", value: "GIRIS_YAP" },
    { label: "İptal", value: "IPTAL" }
  ],
  GIRIS_YAPILDI: [{ label: "Çıkış Yap", value: "CIKIS_YAP" }],
  CIKIS_YAPILDI: [],
  IPTAL: []
};

export function RezervasyonListClient({ rezervasyonlar, hotels, selectedHotelId }: Props) {
  const [durumFilter, setDurumFilter] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(
    () => rezervasyonlar.filter((item) => !durumFilter || item.durum === durumFilter),
    [durumFilter, rezervasyonlar]
  );

  async function changeStatus(id: number, islem: string) {
    setMessage("");
    const response = await fetch(`/api/rezervasyonlar/${id}/durum`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem })
    });
    const payload = await response.json();
    if (!response.ok && response.status !== 202) {
      setMessage(payload.message ?? "Durum güncellenemedi.");
      return;
    }
    if (response.status === 202) {
      setMessage(payload.message ?? "Onay talebi oluşturuldu.");
      return;
    }
    window.location.reload();
  }

  const columns = useMemo<ColumnDef<RezervasyonRow>[]>(
    () => [
      { accessorKey: "otel.ad", header: "Otel", cell: ({ row }) => row.original.otel.ad },
      { accessorKey: "oda.odaNo", header: "Oda", cell: ({ row }) => row.original.oda.odaNo },
      { accessorKey: "cari.ad", header: "Cari", cell: ({ row }) => row.original.cari.ad },
      { accessorKey: "girisTarihi", header: "Giriş", cell: ({ row }) => formatDateTR(row.original.girisTarihi) },
      { accessorKey: "cikisTarihi", header: "Çıkış", cell: ({ row }) => formatDateTR(row.original.cikisTarihi) },
      { accessorKey: "kisiSayisi", header: "Kişi" },
      {
        accessorKey: "toplamTutar",
        header: "Tutar",
        cell: ({ row }) => <div className="text-right">{formatMoneyTR(row.original.toplamTutar)}</div>
      },
      { accessorKey: "durum", header: "Durum", cell: ({ row }) => REZERVASYON_DURUM_LABELS[row.original.durum] },
      {
        id: "islem",
        header: "İşlem",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {actionsByStatus[row.original.durum].map((action) => (
              <Button key={action.value} className="h-8" type="button" variant="secondary" onClick={() => changeStatus(row.original.id, action.value)}>
                {action.label}
              </Button>
            ))}
          </div>
        )
      }
    ],
    []
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rezervasyonlar</h1>
          <p className="mt-1 text-sm text-muted">Rezervasyon listesi, durum akışı ve iptal talepleri.</p>
        </div>
        <div className="flex gap-2">
          <Link className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white" href={`/rezervasyonlar/yeni?otelId=${selectedHotelId}`}>
            Yeni Rezervasyon
          </Link>
          <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium" href={`/doluluk?otelId=${selectedHotelId}`}>
            Takvim
          </Link>
        </div>
      </div>
      <section className="grid gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form action="/rezervasyonlar" className="flex items-center gap-2">
            <Select name="otelId" defaultValue={selectedHotelId}>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.ad}
                </option>
              ))}
            </Select>
            <Button type="submit">Seç</Button>
          </form>
          <label className="grid gap-1 text-sm">
            Durum
            <Select value={durumFilter} onChange={(event) => setDurumFilter(event.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(REZERVASYON_DURUM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {message ? <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div> : null}
        <DataTable columns={columns} data={filtered} searchPlaceholder="Cari, oda veya otel ara" />
      </section>
    </div>
  );
}
