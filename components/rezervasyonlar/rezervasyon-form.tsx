"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  REZERVASYON_DURUM_LABELS,
  centsToDecimalString,
  decimalToCents,
  formatMoneyTR,
  nightCount,
  todayIstanbulDateString
} from "@/lib/faz3";

type HotelOption = { id: number; ad: string };
type CariOption = { id: number; ad: string; bakiye: string };
type RoomOption = {
  id: number;
  odaNo: string;
  odaTipi: string | null;
  kapasite: number;
  operasyonDurumu: string;
  musaitMi: boolean;
  kat: { ad: string };
};

type RezervasyonFormProps = {
  hotels: HotelOption[];
  cariler: CariOption[];
  initialRooms: RoomOption[];
  selectedHotelId: number;
  initialRoomId?: number;
  initialDate?: string;
};

export function RezervasyonForm({
  hotels,
  cariler,
  initialRooms,
  selectedHotelId,
  initialRoomId,
  initialDate
}: RezervasyonFormProps) {
  const today = initialDate ?? todayIstanbulDateString();
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [otelId, setOtelId] = useState(selectedHotelId);
  const [rooms, setRooms] = useState(initialRooms);
  const [odaId, setOdaId] = useState(initialRoomId ?? initialRooms[0]?.id ?? 0);
  const [cariId, setCariId] = useState(cariler[0]?.id ?? 0);
  const [girisTarihi, setGirisTarihi] = useState(today);
  const [girisSaati, setGirisSaati] = useState("14:00");
  const [cikisTarihi, setCikisTarihi] = useState(tomorrow.toISOString().slice(0, 10));
  const [cikisSaati, setCikisSaati] = useState("12:00");
  const [kisiSayisi, setKisiSayisi] = useState(1);
  const [ucretTipi, setUcretTipi] = useState<"TOPLAM" | "KISI_BASI">("TOPLAM");
  const [birimUcret, setBirimUcret] = useState("");
  const [toplamTutar, setToplamTutar] = useState("");
  const [not, setNot] = useState("");
  const [message, setMessage] = useState("");

  const selectedRoom = rooms.find((room) => room.id === odaId) ?? null;
  const selectedCari = cariler.find((cari) => cari.id === cariId) ?? null;
  const geceSayisi = nightCount(girisTarihi, cikisTarihi);
  const calculatedTotalCents =
    ucretTipi === "KISI_BASI" ? decimalToCents(birimUcret) * kisiSayisi * Math.max(geceSayisi, 0) : decimalToCents(toplamTutar);

  const capacityWarning = selectedRoom && kisiSayisi > selectedRoom.kapasite;

  useEffect(() => {
    async function loadAvailability() {
      if (!otelId || !girisTarihi || !cikisTarihi) return;
      const response = await fetch(`/api/hotels/${otelId}/rooms/availability?giris=${girisTarihi}&cikis=${cikisTarihi}`);
      if (!response.ok) return;
      const payload = await response.json();
      setRooms(payload.odalar);
      if (!payload.odalar.some((room: RoomOption) => room.id === odaId)) {
        setOdaId(payload.odalar[0]?.id ?? 0);
      }
    }
    void loadAvailability();
  }, [cikisTarihi, girisTarihi, odaId, otelId]);

  const roomOptions = useMemo(
    () =>
      rooms.map((room) => ({
        ...room,
        label: `${room.kat.ad} / ${room.odaNo} · ${room.odaTipi ?? "Oda"} · ${room.kapasite} kişi · ${
          room.musaitMi ? "Müsait" : "Dolu"
        }`
      })),
    [rooms]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/rezervasyonlar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otelId,
        odaId,
        cariId,
        girisTarihi,
        girisSaati,
        cikisTarihi,
        cikisSaati,
        kisiSayisi,
        ucretTipi,
        birimUcret,
        toplamTutar,
        not
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Rezervasyon oluşturulamadı.");
      return;
    }
    window.location.href = `/rezervasyonlar?otelId=${otelId}`;
  }

  return (
    <form className="grid gap-5 rounded-md border border-border bg-surface p-4" onSubmit={submit}>
      <div>
        <h1 className="text-2xl font-semibold">Yeni Rezervasyon</h1>
        <p className="mt-1 text-sm text-muted">Otel, oda, tarih, cari, kişi sayısı ve tutar bilgileri.</p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          Otel
          <Select value={otelId} onChange={(event) => setOtelId(Number(event.target.value))}>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.ad}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Oda
          <Select value={odaId} onChange={(event) => setOdaId(Number(event.target.value))}>
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id} disabled={!room.musaitMi}>
                {room.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Giriş Tarihi
          <Input type="date" value={girisTarihi} onChange={(event) => setGirisTarihi(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Giriş Saati
          <Input type="time" value={girisSaati} onChange={(event) => setGirisSaati(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Çıkış Tarihi
          <Input type="date" value={cikisTarihi} onChange={(event) => setCikisTarihi(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Çıkış Saati
          <Input type="time" value={cikisSaati} onChange={(event) => setCikisSaati(event.target.value)} />
        </label>
      </section>

      <div className={geceSayisi <= 0 ? "rounded-md bg-red-50 px-3 py-2 text-sm text-danger" : "text-sm text-muted"}>
        Gece sayısı: {geceSayisi > 0 ? geceSayisi : "Çıkış tarihi giriş tarihinden sonra olmalıdır."}
      </div>

      <section className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          Cari
          <Select value={cariId} onChange={(event) => setCariId(Number(event.target.value))}>
            {cariler.map((cari) => (
              <option key={cari.id} value={cari.id}>
                {cari.ad}
              </option>
            ))}
          </Select>
        </label>
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          Mevcut bakiye
          <div className="mt-1 font-medium">{formatMoneyTR(selectedCari?.bakiye ?? "0")}</div>
        </div>
        <label className="grid gap-1 text-sm">
          Kişi Sayısı
          <Input type="number" min={1} value={kisiSayisi} onChange={(event) => setKisiSayisi(Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-sm">
          Ücret Tipi
          <Select value={ucretTipi} onChange={(event) => setUcretTipi(event.target.value as "TOPLAM" | "KISI_BASI")}>
            <option value="TOPLAM">Toplam</option>
            <option value="KISI_BASI">Kişi Başı</option>
          </Select>
        </label>
        {ucretTipi === "KISI_BASI" ? (
          <label className="grid gap-1 text-sm">
            Birim Ücret
            <Input value={birimUcret} onChange={(event) => setBirimUcret(event.target.value)} placeholder="1500.00" />
          </label>
        ) : (
          <label className="grid gap-1 text-sm">
            Toplam Tutar
            <Input value={toplamTutar} onChange={(event) => setToplamTutar(event.target.value)} placeholder="5000.00" />
          </label>
        )}
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          Hesaplanan toplam
          <div className="mt-1 font-medium">{formatMoneyTR(centsToDecimalString(calculatedTotalCents))}</div>
        </div>
      </section>

      {capacityWarning ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu oda {selectedRoom.kapasite} kişilik, {kisiSayisi} kişi giriliyor.
        </div>
      ) : null}

      <label className="grid gap-1 text-sm">
        Not
        <Textarea value={not} onChange={(event) => setNot(event.target.value)} placeholder="Opsiyonel not" />
      </label>

      {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{message}</div> : null}
      <div className="flex items-center gap-2">
        <Button disabled={geceSayisi <= 0 || !odaId || !cariId} type="submit">
          Rezervasyonu Kaydet
        </Button>
        <span className="text-sm text-muted">Kaydedilince durum {REZERVASYON_DURUM_LABELS.BEKLEMEDE} olur.</span>
      </div>
    </form>
  );
}
