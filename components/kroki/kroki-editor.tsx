"use client";

import type { OdaOperasyonDurumu } from "@prisma/client";
import { Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  KROKI_HEIGHT,
  KROKI_WIDTH,
  ROOM_DEFAULT_HEIGHT,
  ROOM_DEFAULT_WIDTH,
  ROOM_MAX_HEIGHT,
  ROOM_MAX_WIDTH,
  ROOM_MIN_HEIGHT,
  ROOM_MIN_WIDTH,
  STATUS_COLORS,
  STATUS_LABELS
} from "@/lib/kroki";

export type KrokiRoom = {
  id: number;
  odaNo: string;
  odaTipi: string | null;
  kapasite: number;
  aciklama: string | null;
  operasyonDurumu: OdaOperasyonDurumu;
  krokiX: number | null;
  krokiY: number | null;
  krokiGenislik: number | null;
  krokiYukseklik: number | null;
  aktifRezervasyon: {
    cariAd: string;
    giris: string;
    cikis: string;
    kisiSayisi: number;
  } | null;
};

type HotelOption = { id: number; ad: string };
type FloorOption = { id: number; ad: string; sira: number };
type DragState =
  | { mode: "move"; roomId: number; offsetX: number; offsetY: number }
  | { mode: "resize"; roomId: number };

type KrokiEditorProps = {
  hotels: HotelOption[];
  floors: FloorOption[];
  selectedHotelId: number;
  selectedFloorId: number | null;
  initialRooms: KrokiRoom[];
  sketchExists: boolean;
};

const statuses: OdaOperasyonDurumu[] = ["BOS", "DOLU", "REZERVE", "BAKIM", "TEMIZLIK"];

function isPlaced(room: KrokiRoom) {
  return (
    room.krokiX !== null &&
    room.krokiY !== null &&
    room.krokiGenislik !== null &&
    room.krokiYukseklik !== null
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

export function KrokiEditor({
  hotels,
  floors,
  selectedHotelId,
  selectedFloorId,
  initialRooms,
  sketchExists
}: KrokiEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rooms, setRooms] = useState(initialRooms);
  const [editMode, setEditMode] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(initialRooms[0]?.id ?? null);
  const [message, setMessage] = useState("");
  const [hasSketch, setHasSketch] = useState(sketchExists);
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  useEffect(() => {
    setRooms(initialRooms);
    setSelectedRoomId(initialRooms[0]?.id ?? null);
    setHasSketch(sketchExists);
    setEditMode(false);
    setMessage("");
  }, [initialRooms, selectedFloorId, selectedHotelId, sketchExists]);

  const placedRooms = useMemo(() => rooms.filter(isPlaced), [rooms]);
  const unplacedRooms = useMemo(() => rooms.filter((room) => !isPlaced(room)), [rooms]);

  function svgPoint(event: React.MouseEvent<SVGSVGElement | SVGGElement | SVGRectElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * KROKI_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * KROKI_HEIGHT
    };
  }

  function updateRoomPosition(roomId: number, patch: Partial<KrokiRoom>) {
    setRooms((current) => current.map((room) => (room.id === roomId ? { ...room, ...patch } : room)));
  }

  function addRoom(roomId: number) {
    updateRoomPosition(roomId, {
      krokiX: Math.round((KROKI_WIDTH - ROOM_DEFAULT_WIDTH) / 2),
      krokiY: Math.round((KROKI_HEIGHT - ROOM_DEFAULT_HEIGHT) / 2),
      krokiGenislik: ROOM_DEFAULT_WIDTH,
      krokiYukseklik: ROOM_DEFAULT_HEIGHT
    });
    setSelectedRoomId(roomId);
  }

  function removeRoom(roomId: number) {
    updateRoomPosition(roomId, {
      krokiX: null,
      krokiY: null,
      krokiGenislik: null,
      krokiYukseklik: null
    });
    setSelectedRoomId(null);
  }

  function startMove(event: React.MouseEvent<SVGGElement>, room: KrokiRoom) {
    if (!editMode || !isPlaced(room)) return;
    event.preventDefault();
    event.stopPropagation();
    const point = svgPoint(event);
    setDragState({
      mode: "move",
      roomId: room.id,
      offsetX: point.x - (room.krokiX ?? 0),
      offsetY: point.y - (room.krokiY ?? 0)
    });
    setSelectedRoomId(room.id);
  }

  function startResize(event: React.MouseEvent<SVGRectElement>, roomId: number) {
    if (!editMode) return;
    event.preventDefault();
    event.stopPropagation();
    setDragState({ mode: "resize", roomId });
    setSelectedRoomId(roomId);
  }

  function onMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!dragState) return;
    const point = svgPoint(event);
    const room = rooms.find((item) => item.id === dragState.roomId);
    if (!room || !isPlaced(room)) return;

    if (dragState.mode === "move") {
      const width = room.krokiGenislik ?? ROOM_DEFAULT_WIDTH;
      const height = room.krokiYukseklik ?? ROOM_DEFAULT_HEIGHT;
      updateRoomPosition(room.id, {
        krokiX: Math.round(clamp(point.x - dragState.offsetX, 0, KROKI_WIDTH - width)),
        krokiY: Math.round(clamp(point.y - dragState.offsetY, 0, KROKI_HEIGHT - height))
      });
      return;
    }

    const x = room.krokiX ?? 0;
    const y = room.krokiY ?? 0;
    const width = clamp(point.x - x, ROOM_MIN_WIDTH, Math.min(ROOM_MAX_WIDTH, KROKI_WIDTH - x));
    const height = clamp(point.y - y, ROOM_MIN_HEIGHT, Math.min(ROOM_MAX_HEIGHT, KROKI_HEIGHT - y));
    updateRoomPosition(room.id, {
      krokiGenislik: Math.round(width),
      krokiYukseklik: Math.round(height)
    });
  }

  async function savePositions() {
    if (!selectedFloorId) return;
    setMessage("");
    const response = await fetch(`/api/hotels/${selectedHotelId}/floors/${selectedFloorId}/room-positions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        odalar: rooms.map((room) => ({
          id: room.id,
          krokiX: room.krokiX,
          krokiY: room.krokiY,
          krokiGenislik: room.krokiGenislik,
          krokiYukseklik: room.krokiYukseklik
        }))
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "Kroki kaydedilemedi.");
      return;
    }
    setHasSketch(true);
    setEditMode(false);
    setMessage("Kroki kaydedildi.");
  }

  async function changeStatus(formData: FormData) {
    if (!selectedRoom) return;
    const nextStatus = String(formData.get("operasyonDurumu")) as OdaOperasyonDurumu;
    const response = await fetch(`/api/rooms/${selectedRoom.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operasyonDurumu: nextStatus })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "Oda durumu güncellenemedi.");
      return;
    }
    updateRoomPosition(selectedRoom.id, { operasyonDurumu: payload.oda.operasyonDurumu });
    setMessage(`Oda ${selectedRoom.odaNo} durumu ${STATUS_LABELS[nextStatus]} olarak güncellendi.`);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kroki</h1>
          <p className="mt-1 text-sm text-muted">{selectedHotel?.ad ?? "Otel"} için kat krokisi ve oda operasyonları.</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/kroki" className="flex items-center gap-2">
            <input name="otelId" type="hidden" value={selectedHotelId} />
            <label className="text-sm font-medium text-muted" htmlFor="katId">
              Kat
            </label>
            <Select className="min-w-48" id="katId" name="katId" defaultValue={selectedFloorId ?? ""}>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.ad}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Seç
            </Button>
          </form>
          <Button
            disabled={!selectedFloorId}
            onClick={() => (editMode ? void savePositions() : setEditMode(true))}
            type="button"
          >
            {editMode ? (
              <>
                <Save className="h-4 w-4" />
                Kaydet ve Bitir
              </>
            ) : (
              "Düzenle"
            )}
          </Button>
        </div>
      </div>

      {message ? <div className="rounded-md bg-accentSoft px-3 py-2 text-sm">{message}</div> : null}
      {editMode ? (
        <div className="rounded-md border border-accent bg-accentSoft px-3 py-2 text-sm">
          Düzenleme modu - Odaları sürükleyerek yerleştirin, sağ-alt köşeden boyutlandırın.
        </div>
      ) : null}

      {editMode ? (
        <section className="rounded-md border border-border bg-surface p-3">
          <h2 className="text-sm font-semibold">Yerleştirilmemiş Odalar</h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {unplacedRooms.length ? (
              unplacedRooms.map((room) => (
                <div key={room.id} className="flex min-w-56 items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span>
                    {room.odaNo} {room.odaTipi ?? "Oda"} · {room.kapasite} kişi
                  </span>
                  <Button type="button" variant="secondary" onClick={() => addRoom(room.id)}>
                    Ekle
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted">Tüm odalar krokide yer alıyor.</div>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_350px] gap-4 max-xl:grid-cols-1">
        <section className="overflow-x-auto rounded-md border border-border bg-surface p-3">
          <svg
            ref={svgRef}
            className="min-w-[900px] touch-none rounded-md border border-border bg-[#f9fafb]"
            viewBox={`0 0 ${KROKI_WIDTH} ${KROKI_HEIGHT}`}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setDragState(null)}
            onMouseUp={() => setDragState(null)}
          >
            {editMode ? (
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                </pattern>
              </defs>
            ) : null}
            <rect width={KROKI_WIDTH} height={KROKI_HEIGHT} fill={editMode ? "url(#grid)" : "#f9fafb"} />
            {!hasSketch && !placedRooms.length ? (
              <text x={KROKI_WIDTH / 2} y={KROKI_HEIGHT / 2} textAnchor="middle" fontSize="26" fill="#65727c">
                Bu kat için henüz kroki oluşturulmamış. Düzenle butonuna basarak odaları yerleştirin.
              </text>
            ) : null}
            {placedRooms.map((room) => {
              const selected = room.id === selectedRoomId;
              const x = room.krokiX ?? 0;
              const y = room.krokiY ?? 0;
              const width = room.krokiGenislik ?? ROOM_DEFAULT_WIDTH;
              const height = room.krokiYukseklik ?? ROOM_DEFAULT_HEIGHT;
              return (
                <g
                  key={room.id}
                  className={editMode ? "cursor-move" : "cursor-pointer"}
                  onClick={() => setSelectedRoomId(room.id)}
                  onMouseDown={(event) => startMove(event, room)}
                >
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="6"
                    fill={STATUS_COLORS[room.operasyonDurumu]}
                    stroke={selected ? "#d9911f" : "#374151"}
                    strokeWidth={selected ? 4 : 2}
                  />
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 7}
                    textAnchor="middle"
                    fontSize="22"
                    fontWeight="700"
                    fill={room.operasyonDurumu === "DOLU" ? "#ffffff" : "#0f172a"}
                    pointerEvents="none"
                  >
                    {room.odaNo}
                  </text>
                  {editMode ? (
                    <>
                      <g
                        className="cursor-pointer"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRoom(room.id);
                        }}
                      >
                        <rect x={x - 8} y={y - 8} width="24" height="24" rx="4" fill="#ffffff" stroke="#b42318" />
                        <X x={x - 3} y={y - 3} width="14" height="14" color="#b42318" />
                      </g>
                      <rect
                        className="cursor-se-resize"
                        x={x + width - 12}
                        y={y + height - 12}
                        width="12"
                        height="12"
                        fill="#d9911f"
                        onMouseDown={(event) => startResize(event, room.id)}
                      />
                    </>
                  ) : null}
                </g>
              );
            })}
          </svg>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {statuses.map((status) => (
              <span key={status} className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                {STATUS_LABELS[status]}
              </span>
            ))}
          </div>
        </section>

        <aside className="rounded-md border border-border bg-surface p-4">
          {selectedRoom ? (
            <div className="grid gap-4">
              <div>
                <h2 className="text-xl font-semibold">Oda {selectedRoom.odaNo}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedRoom.odaTipi ?? "Oda"} · {selectedRoom.kapasite} kişi
                </p>
              </div>
              <form
                className="grid gap-2"
                action={(formData) => {
                  void changeStatus(formData);
                }}
              >
                <label className="text-sm font-medium" htmlFor="operasyonDurumu">
                  Durum
                </label>
                <Select id="operasyonDurumu" name="operasyonDurumu" defaultValue={selectedRoom.operasyonDurumu}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
                <Button type="submit">Değiştir</Button>
              </form>
              <div>
                <h3 className="text-sm font-semibold">Açıklama</h3>
                <p className="mt-1 text-sm text-muted">{selectedRoom.aciklama ?? "Açıklama yok."}</p>
              </div>
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Aktif Rezervasyon</h3>
                {selectedRoom.aktifRezervasyon ? (
                  <div className="mt-2 grid gap-1 text-sm text-muted">
                    <div>Cari: {selectedRoom.aktifRezervasyon.cariAd}</div>
                    <div>
                      Tarih: {formatDate(selectedRoom.aktifRezervasyon.giris)} - {formatDate(selectedRoom.aktifRezervasyon.cikis)}
                    </div>
                    <div>Kişi sayısı: {selectedRoom.aktifRezervasyon.kisiSayisi}</div>
                    <div>Tutar bilgisi Faz 3'te eklenecek.</div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">Bu odada aktif bir rezervasyon yok.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted">Detay görmek için krokiden bir oda seçin.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
