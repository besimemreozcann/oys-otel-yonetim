"use client";

import { useState } from "react";
import { formatDateTR } from "@/lib/faz3";

type LogRow = {
  id: number;
  tarihSaat: string;
  kullanici: string;
  otel: string;
  islemTuru: string;
  tablo: string;
  kayitId: number;
  aciklama: string;
  oncekiDeger: unknown;
  yeniDeger: unknown;
};

export function LogTableClient({ rows }: { rows: LogRow[] }) {
  const [selected, setSelected] = useState<LogRow | null>(null);
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
            <tr><th className="px-3 py-2">Tarih/Saat</th><th>Kullanıcı</th><th>Otel</th><th>İşlem</th><th>Tablo</th><th>Kayıt</th><th>Açıklama</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-t border-border hover:bg-accentSoft" onClick={() => setSelected(row)}>
                <td className="px-3 py-2">{formatDateTR(row.tarihSaat)}</td>
                <td>{row.kullanici}</td>
                <td>{row.otel}</td>
                <td>{row.islemTuru}</td>
                <td>{row.tablo}</td>
                <td>{row.kayitId}</td>
                <td>{row.aciklama}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div className="rounded-md border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Log Detayı #{selected.id}</h3>
            <button className="text-sm text-accent hover:underline" type="button" onClick={() => setSelected(null)}>Kapat</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <pre className="max-h-72 overflow-auto rounded-md bg-[#eef3f6] p-3 text-xs">{JSON.stringify(selected.oncekiDeger, null, 2) || "-"}</pre>
            <pre className="max-h-72 overflow-auto rounded-md bg-[#eef3f6] p-3 text-xs">{JSON.stringify(selected.yeniDeger, null, 2) || "-"}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
