# Değişiklik Günlüğü

## 0.1.0 - Faz 1

- Next.js 14 App Router, TypeScript, Tailwind CSS ve shadcn/ui uyumlu yerel UI bileşenleri eklendi.
- Sağlanan Prisma şeması `prisma/schema.prisma` konumuna taşındı.
- Docker Compose ile PostgreSQL 16 ve app servisleri tanımlandı.
- Kullanıcı adı/şifre girişi, ilk kullanıcı kurulumu ve "beni hatırla" oturumu eklendi.
- Otel bazlı sunucu taraflı yetki katmanı yazıldı.
- SUPER_ADMIN kullanıcı yönetimi ve kullanıcı × otel × işlem yetki matrisi eklendi.
- Otel, kat ve oda ekleme/listeleme ekranları eklendi.
- Seed script 1 şirket, 3 otel, katlar, odalar, kullanıcılar, cariler, kasa ve banka hesapları üretir.
- Vitest ile temel yetki katmanı testleri eklendi.
