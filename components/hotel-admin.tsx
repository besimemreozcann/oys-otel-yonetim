"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Hotel = {
  id: number;
  ad: string;
  adres: string | null;
  telefon: string | null;
  eposta: string | null;
  katlar: { id: number; ad: string; sira: number }[];
  odalar: { id: number; odaNo: string; odaTipi: string | null; kapasite: number; aktifMi: boolean; kat: { ad: string } }[];
};

export function HotelAdmin({ hotels }: { hotels: Hotel[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const columns = useMemo<ColumnDef<Hotel>[]>(
    () => [
      { accessorKey: "ad", header: "Otel" },
      { accessorKey: "telefon", header: "Telefon" },
      { accessorKey: "eposta", header: "E-posta" },
      { accessorFn: (row) => row.katlar.length, id: "kat", header: "Kat" },
      { accessorFn: (row) => row.odalar.length, id: "oda", header: "Oda" }
    ],
    []
  );

  async function submit(endpoint: string, form: HTMLFormElement) {
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "Kayıt yapılamadı.");
      return;
    }
    form.reset();
    setMessage("Kayıt başarıyla tamamlandı.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Otel, kat ve oda yönetimi</h1>
          <p className="mt-1 text-sm text-muted">Faz 1 kapsamında kroki ve oda operasyon ekranları burada yer almaz.</p>
        </div>
        {message ? <div className="rounded-md bg-accentSoft px-3 py-2 text-sm text-foreground">{message}</div> : null}
        <DataTable columns={columns} data={hotels} searchPlaceholder="Otel ara" />
      </section>

      <section className="grid grid-cols-3 gap-4">
        <form
          className="grid gap-3 rounded-md border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/hotels", event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Otel ekle</h2>
          <Input name="ad" placeholder="Otel adı" required />
          <Textarea name="adres" placeholder="Adres" />
          <Input name="telefon" placeholder="Telefon" />
          <Input name="eposta" placeholder="E-posta" type="email" />
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Ekle
          </Button>
        </form>

        <form
          className="grid gap-3 rounded-md border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/floors", event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Kat ekle</h2>
          <Select name="otelId" required>
            <option value="">Otel seçin</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.ad}
              </option>
            ))}
          </Select>
          <Input name="ad" placeholder="Kat adı" required />
          <Input name="sira" placeholder="Sıra" type="number" defaultValue="0" />
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Ekle
          </Button>
        </form>

        <form
          className="grid gap-3 rounded-md border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/rooms", event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Oda ekle</h2>
          <Select name="otelId" required>
            <option value="">Otel seçin</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.ad}
              </option>
            ))}
          </Select>
          <Select name="katId" required>
            <option value="">Kat seçin</option>
            {hotels.flatMap((hotel) =>
              hotel.katlar.map((kat) => (
                <option key={kat.id} value={kat.id}>
                  {hotel.ad} · {kat.ad}
                </option>
              ))
            )}
          </Select>
          <Input name="odaNo" placeholder="Oda no" required />
          <Input name="odaTipi" placeholder="Oda tipi" />
          <Input name="kapasite" placeholder="Kapasite" required type="number" min="1" />
          <Textarea name="aciklama" placeholder="Açıklama" />
          <Button type="submit">
            <Save className="h-4 w-4" />
            Kaydet
          </Button>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-semibold">Odalar</h2>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Otel</th>
                <th className="px-3 py-2">Kat</th>
                <th className="px-3 py-2">Oda no</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Kapasite</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {hotels.flatMap((hotel) =>
                hotel.odalar.map((oda) => (
                  <tr key={oda.id} className="border-t border-border">
                    <td className="px-3 py-2">{hotel.ad}</td>
                    <td className="px-3 py-2">{oda.kat.ad}</td>
                    <td className="px-3 py-2">{oda.odaNo}</td>
                    <td className="px-3 py-2">{oda.odaTipi ?? "-"}</td>
                    <td className="px-3 py-2">{oda.kapasite}</td>
                    <td className="px-3 py-2">{oda.aktifMi ? "Aktif" : "Pasif"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
