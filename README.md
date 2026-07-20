# OYS — Çoklu Otel Yönetim Sistemi

Faz 1 teslimi: Next.js App Router, Prisma/PostgreSQL, kullanıcı girişi, otel bazlı yetki katmanı, kullanıcı yetki matrisi ve otel/kat/oda CRUD.

## Kurulum

1. `.env.example` dosyasını `.env` olarak kopyalayın.
2. PostgreSQL'i başlatın:

```bash
docker compose up -d postgres
```

3. Bağımlılıkları kurun ve Prisma istemcisini üretin:

```bash
npm install
npm run prisma:generate
```

4. Migration ve seed çalıştırın:

```bash
npx prisma migrate dev
npm run prisma:seed
```

5. Uygulamayı başlatın:

```bash
npm run dev
```

Panel: `http://localhost:3000`

## Seed kullanıcıları

| Rol | Kullanıcı adı | Şifre |
|---|---|---|
| SUPER_ADMIN | `superadmin` | `SuperAdmin123!` |
| ADMIN | `admin` | `Admin123!` |
| PERSONEL | `personel.a` | `Personel123!` |
| PERSONEL | `personel.b` | `Personel123!` |

`personel.a` yalnızca ilk otele, `personel.b` yalnızca ikinci otele yetkilidir.

## Test

```bash
npm run test
```

Testler otel bazlı erişim, finans yetkisi 403 kontrolü ve SUPER_ADMIN erişimini doğrular.

## Notlar

- Tüm kullanıcı arayüzü metinleri Türkçedir.
- Zaman dilimi `Europe/Istanbul` olarak ayarlanmıştır.
- Rezervasyon çakışma constraint'i ilk migration SQL'ine eklenir.
- Auth.js paketleri projeye dahil edilmiştir; sağlanan şemada Auth.js adapter session tabloları olmadığı için Faz 1 uygulaması güvenli HTTP-only oturum çereziyle çalışır.
