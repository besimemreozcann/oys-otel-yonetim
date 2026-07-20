"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReportType } from "@/lib/reports";

type Props = {
  reportType: ReportType;
  filters: Record<string, string | number | undefined>;
  disabled?: boolean;
};

export function ExportButtons({ reportType, filters, disabled }: Props) {
  const [message, setMessage] = useState("");

  async function download(kind: "pdf" | "excel") {
    setMessage("");
    const response = await fetch(`/api/raporlar/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raporTuru: reportType, ...filters })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.message ?? "Rapor indirilemedi.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}-${new Date().toISOString().slice(0, 10)}.${kind === "pdf" ? "pdf" : "xlsx"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={disabled} type="button" variant="secondary" onClick={() => download("pdf")}>
        PDF İndir
      </Button>
      <Button disabled={disabled} type="button" variant="secondary" onClick={() => download("excel")}>
        Excel İndir
      </Button>
      {message ? <span className="text-sm text-danger">{message}</span> : null}
    </div>
  );
}
