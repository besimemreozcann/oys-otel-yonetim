"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTR } from "@/lib/faz3";

type OnayRow = {
  id: number;
  tur: string;
  durum: string;
  hedefTablo: string;
  hedefKayitId: number;
  istenenDegisiklik: unknown;
  createdAt: string | Date;
  kararTarihi: string | Date | null;
  kararAciklamasi: string | null;
  talepEden: { adSoyad: string; kullaniciAdi: string };
  kararVeren: { adSoyad: string; kullaniciAdi: string } | null;
  otel: { ad: string };
};

export function OnayKuyruguClient({ rows }: { rows: OnayRow[] }) {
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function decide(id: number, action: "onayla" | "reddet") {
    setMessage("");
    const kararAciklamasi =
      action === "reddet" ? window.prompt("Red aciklamasi") : window.prompt("Onay aciklamasi (opsiyonel)", "");
    if (action === "reddet" && !kararAciklamasi?.trim()) {
      setMessage("Red icin aciklama zorunludur.");
      return;
    }
    if (kararAciklamasi === null) return;
    setBusyId(id);
    const response = await fetch(`/api/onay-kuyrugu/${id}/${action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kararAciklamasi })
    });
    const payload = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(payload.message ?? "Onay islemi tamamlanamadi.");
      return;
    }
    setMessage(payload.message ?? "Islem tamamlandi.");
    window.location.reload();
  }

  return (
    <div className="grid gap-3">
      {message ? <div className="rounded-md border border-border bg-white px-3 py-2 text-sm">{message}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Tarih</th>
              <th>Otel</th>
              <th>Talep Eden</th>
              <th>Tur</th>
              <th>Hedef</th>
              <th>Durum</th>
              <th className="text-right">Islem</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTR(row.createdAt)}</td>
                  <td>{row.otel.ad}</td>
                  <td>{row.talepEden.adSoyad}</td>
                  <td>{row.tur}</td>
                  <td>{row.hedefTablo} #{row.hedefKayitId}</td>
                  <td>
                    <span className="rounded-md border border-border bg-white px-2 py-1 text-xs">{row.durum}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.durum === "BEKLIYOR" ? (
                      <div className="flex justify-end gap-2">
                        <Button disabled={busyId === row.id} type="button" variant="secondary" onClick={() => decide(row.id, "reddet")}>
                          Reddet
                        </Button>
                        <Button disabled={busyId === row.id} type="button" onClick={() => decide(row.id, "onayla")}>
                          Onayla
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted">{row.kararVeren?.adSoyad ?? "-"} {row.kararTarihi ? `- ${formatDateTR(row.kararTarihi)}` : ""}</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-muted" colSpan={7}>Onay bekleyen talep bulunmuyor.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
