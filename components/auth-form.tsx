"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  hasUsers: boolean;
};

export function AuthForm({ hasUsers }: AuthFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch(hasUsers ? "/api/auth/login" : "/api/auth/first-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    const payload = await response.json();

    setLoading(false);
    if (!response.ok) {
      setMessage(payload.message ?? "İşlem tamamlanamadı.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {!hasUsers ? (
        <label className="grid gap-1 text-sm font-medium">
          Ad soyad
          <Input name="adSoyad" placeholder="Sistem Yöneticisi" required />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm font-medium">
        Kullanıcı adı
        <Input autoComplete="username" name="kullaniciAdi" placeholder="Kullanıcı adınızı yazın" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Şifre
        <Input autoComplete={hasUsers ? "current-password" : "new-password"} minLength={6} name="sifre" required type="password" />
      </label>
      {hasUsers ? (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input className="h-4 w-4 accent-accent" name="beniHatirla" type="checkbox" value="true" />
          Beni hatırla
        </label>
      ) : null}
      {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{message}</div> : null}
      <Button disabled={loading} type="submit">
        {loading ? "İşleniyor..." : hasUsers ? "Giriş yap" : "İlk kullanıcıyı oluştur"}
      </Button>
    </form>
  );
}
