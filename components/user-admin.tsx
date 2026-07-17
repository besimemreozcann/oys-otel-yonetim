"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Save, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Hotel = { id: number; ad: string };
type Permission = {
  otelId: number;
  rezervasyonYetkisi: string;
  cariYetkisi: string;
  finansYetkisi: string;
  raporYetkisi: string;
};
type User = {
  id: number;
  adSoyad: string;
  kullaniciAdi: string;
  rol: string;
  aktifMi: boolean;
  otelYetkileri: Permission[];
};

const rezervasyon = ["YOK", "GORUNTULE", "EKLE", "TAM"];
const cari = ["YOK", "GORUNTULE", "TAHSILAT", "TAM"];
const finans = ["YOK", "GORUNTULE", "SINIRLI", "TAM"];
const rapor = ["YOK", "GORUNTULE", "TAM"];

export function UserAdmin({ users, hotels }: { users: User[]; hotels: Hotel[] }) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? 0);
  const [message, setMessage] = useState("");
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { accessorKey: "adSoyad", header: "Ad soyad" },
      { accessorKey: "kullaniciAdi", header: "Kullanıcı adı" },
      { accessorKey: "rol", header: "Rol" },
      { accessorFn: (row) => (row.aktifMi ? "Aktif" : "Pasif"), id: "aktif", header: "Durum" }
    ],
    []
  );

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "Kullanıcı kaydedilemedi.");
      return;
    }
    event.currentTarget.reset();
    setMessage("Kullanıcı kaydedildi.");
    router.refresh();
  }

  async function savePermissions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;
    const form = new FormData(event.currentTarget);
    const permissions = hotels.map((hotel) => ({
      otelId: hotel.id,
      rezervasyonYetkisi: String(form.get(`${hotel.id}:rezervasyonYetkisi`) ?? "YOK"),
      cariYetkisi: String(form.get(`${hotel.id}:cariYetkisi`) ?? "YOK"),
      finansYetkisi: String(form.get(`${hotel.id}:finansYetkisi`) ?? "YOK"),
      raporYetkisi: String(form.get(`${hotel.id}:raporYetkisi`) ?? "YOK")
    }));
    const response = await fetch(`/api/users/${selectedUser.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "Yetkiler kaydedilemedi.");
      return;
    }
    setMessage("Yetki matrisi kaydedildi.");
    router.refresh();
  }

  function current(hotelId: number, key: keyof Permission, fallback: string) {
    return selectedUser?.otelYetkileri.find((permission) => permission.otelId === hotelId)?.[key] ?? fallback;
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Kullanıcı yönetimi</h1>
        <p className="mt-1 text-sm text-muted">Bu ekran yalnızca SUPER_ADMIN rolüne açıktır.</p>
      </div>
      {message ? <div className="rounded-md bg-accentSoft px-3 py-2 text-sm">{message}</div> : null}

      <section className="grid grid-cols-[1fr_360px] gap-4">
        <DataTable columns={columns} data={users} searchPlaceholder="Kullanıcı ara" />
        <form className="grid gap-3 rounded-md border border-border bg-surface p-4" onSubmit={createUser}>
          <h2 className="text-base font-semibold">Kullanıcı ekle</h2>
          <Input name="adSoyad" placeholder="Ad soyad" required />
          <Input name="kullaniciAdi" placeholder="Kullanıcı adı" required />
          <Input name="sifre" placeholder="Geçici şifre" required type="password" minLength={6} />
          <Select name="rol" defaultValue="PERSONEL">
            <option value="ADMIN">ADMIN</option>
            <option value="PERSONEL">PERSONEL</option>
          </Select>
          <Button type="submit">
            <UserPlus className="h-4 w-4" />
            Ekle
          </Button>
        </form>
      </section>

      <section className="grid gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Otel ve işlem yetki matrisi</h2>
          <Select
            className="max-w-xs"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(Number(event.target.value))}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.adSoyad}
              </option>
            ))}
          </Select>
        </div>
        <form onSubmit={savePermissions}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Otel</th>
                  <th className="px-3 py-2">Rezervasyon</th>
                  <th className="px-3 py-2">Cari</th>
                  <th className="px-3 py-2">Finans</th>
                  <th className="px-3 py-2">Rapor</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((hotel) => (
                  <tr key={hotel.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{hotel.ad}</td>
                    <td className="px-3 py-2">
                      <Select name={`${hotel.id}:rezervasyonYetkisi`} defaultValue={current(hotel.id, "rezervasyonYetkisi", "YOK")}>
                        {rezervasyon.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select name={`${hotel.id}:cariYetkisi`} defaultValue={current(hotel.id, "cariYetkisi", "YOK")}>
                        {cari.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select name={`${hotel.id}:finansYetkisi`} defaultValue={current(hotel.id, "finansYetkisi", "YOK")}>
                        {finans.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select name={`${hotel.id}:raporYetkisi`} defaultValue={current(hotel.id, "raporYetkisi", "YOK")}>
                        {rapor.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit">
              <Save className="h-4 w-4" />
              Yetkileri kaydet
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
