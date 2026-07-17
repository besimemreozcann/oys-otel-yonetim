# OYS — Çoklu Otel Yönetim Sistemi
## Codex Proje Planı ve Teknik Spesifikasyon

> Bu doküman projenin tek doğruluk kaynağıdır (single source of truth). Kapsam dışı hiçbir modül eklenmeyecek, kapsam içi hiçbir madde atlanmayacaktır. Tüm arayüz dili Türkçedir.

---

## 0. Proje Özeti

Tek şirket altında birden fazla otelin (başlangıçta 3, sınırsız eklenebilir) tek panelden yönetildiği, web tabanlı bir yönetim sistemi.

**Ana veri modeli:** `Tur şirketi (cari) + Otel + Oda + Tarih aralığı + Kişi sayısı + Finansal hareket`

**Kritik kapsam kuralı:** Sistem, odaya giren kişilerin ad-soyad, kimlik veya bireysel konaklama geçmişini ZORUNLU olarak tutmaz. Takip birimi kişi değil; hangi carinin, hangi otele, hangi odaya, hangi tarihlerde, kaç kişi gönderdiğidir. Rezervasyon formunda "misafir adı" zorunlu alanı YOKTUR; opsiyonel not alanı vardır.

---

## 1. Teknoloji Yığını (Stack)

| Katman | Seçim | Gerekçe |
|---|---|---|
| Dil | TypeScript | Tek dil, tip güvenliği, Codex ile en iyi sonuç |
| Framework | Next.js 14+ (App Router) | Frontend + backend (API routes / server actions) tek projede |
| Veritabanı | PostgreSQL 16 | İlişkisel bütünlük, exclusion constraint (çakışma kontrolü), decimal para tipi |
| ORM | Prisma | Şema-öncelikli geliştirme, migration yönetimi |
| Kimlik doğrulama | Auth.js (credentials provider) + veritabanı session | Kullanıcı adı/şifre girişi, sunucu taraflı oturum |
| UI | Tailwind CSS + shadcn/ui | Hızlı, tutarlı, özelleştirilebilir tasarım sistemi |
| Tablolar | TanStack Table | Filtreleme, sıralama, sayfalama (raporlar için kritik) |
| Form/validasyon | React Hook Form + Zod | Zod şemaları hem client hem server tarafında kullanılacak |
| PDF üretimi | Puppeteer (sunucu tarafı, HTML→PDF) | Türkçe karakter ve tablo desteği sorunsuz |
| Excel içe/dışa aktarım | exceljs | Rapor dışa aktarımı |
| Kroki | SVG tabanlı interaktif bileşen | Odalar `<rect>/<path>` + `data-oda-id`; renk durumdan gelir |
| Grafikler | Recharts | Doluluk ve gelir grafikleri |
| Tarih/saat | date-fns + date-fns-tz | Sabit zaman dilimi: `Europe/Istanbul` |
| Deploy | Docker Compose (app + postgres) → Ubuntu VPS + Nginx + Let's Encrypt | Müşteriye staging URL'i buradan verilecek |
| Yedekleme | Günlük `pg_dump` cron + 30 gün saklama + panelden manuel yedek indirme | Kapsam gereği |
| Test | Vitest (birim) + Playwright (kritik akış e2e) | Çakışma, yetki ve cari bakiye testleri zorunlu |

**Mimari kurallar (pazarlıksız):**
1. Bu bir SPA-demo DEĞİLDİR. Tüm veri PostgreSQL'de tutulur; localStorage yalnızca UI tercihi (tema vb.) için kullanılabilir.
2. Para alanları `DECIMAL(14,2)`. JavaScript tarafında asla `float` ile aritmetik yapılmaz; kuruş bazlı integer veya decimal kütüphanesi kullanılır.
3. Her işlemsel tabloda `otel_id` bulunur. Her sorgu, oturumdaki kullanıcının otel yetkileriyle SUNUCU TARAFINDA filtrelenir. UI'da menü gizlemek yetki kontrolü sayılmaz.
4. Cari bakiye ayrı bir kolonda elle güncellenmez; hareket satırlarından hesaplanır (görünüm/materialized view veya sorgu bazlı).
5. Rezervasyon çakışması uygulama kodunda değil, veritabanı seviyesinde engellenir (PostgreSQL `EXCLUDE USING gist` + `daterange`). Aynı odada "çıkış günü = giriş günü" çakışma sayılmaz (yarı-açık aralık `[)`).
6. Silme işlemleri soft-delete'tir (`silindi_mi`, `silinme_tarihi`); log bütünlüğü korunur.

---

## 2. Veri Modeli (Prisma şemasının temeli)

### Organizasyon
- **sirket** — id, ad
- **otel** — id, sirket_id, ad, adres, telefon, eposta, aktif_mi
- **kat** — id, otel_id, ad/no, sira
- **oda** — id, otel_id, kat_id, oda_no, oda_tipi, kapasite, durum(aktif/pasif), operasyon_durumu(bos/dolu/rezerve/bakim/temizlik), aciklama, kroki_konum(x,y,genislik,yukseklik veya path)
- **kroki** — id, otel_id, kat_id?, svg_veri/dosya, olusturma_tarihi

### Kullanıcı ve yetki
- **kullanici** — id, ad_soyad, kullanici_adi, sifre_hash, rol(SUPER_ADMIN/ADMIN/PERSONEL), aktif_mi
- **kullanici_otel_yetkisi** — kullanici_id, otel_id, rezervasyon_yetkisi(yok/goruntule/ekle/tam), cari_yetkisi(yok/goruntule/tahsilat/tam), finans_yetkisi(yok/goruntule/sinirli/tam), rapor_yetkisi
  - Aynı roldeki iki personele farklı otel ve işlem yetkileri verilebilmelidir (kapsam raporundaki yetki matrisi birebir uygulanır).

### Cari
- **cari** — id, ad, tur(TUR_SIRKETI/ACENTE/KURUMSAL/TEDARIKCI/BIREYSEL), vergi_no, vergi_dairesi, adres, telefon, whatsapp, eposta, aktif_mi
- **cari_yetkili** — id, cari_id, ad_soyad, telefon, whatsapp, eposta, gorev
- **iletisim_kaydi** — id, cari_id, kullanici_id, tarih_saat, tur(arandi/ulasilamadi/geri_donus_bekleniyor/whatsapp/not), aciklama

### Rezervasyon
- **rezervasyon** — id, otel_id, oda_id, cari_id, giris_tarihi, giris_saati(varsayılan 14:00), cikis_tarihi, cikis_saati(varsayılan 12:00), kisi_sayisi, ucret_tipi(toplam/kisi_basi), birim_ucret, toplam_tutar, durum(beklemede/onaylandi/giris_yapildi/cikis_yapildi/iptal), not, olusturan_kullanici_id, tarih_araligi(daterange — exclusion constraint için)
- Kural: kisi_sayisi > oda.kapasite ise kayıt engellenmez ama UYARI gösterilir ve log düşülür.

### Finans
- **hesap** — id, otel_id, tur(NAKIT_KASA/BANKA), ad (ör. "Resepsiyon Kasası", "Ziraat Çankaya"), banka_adi?, iban?, aktif_mi
- **cari_hareket** — id, otel_id, cari_id, rezervasyon_id?, tarih, tur(KONAKLAMA_BORC/TAHSILAT/ODEME/DUZELTME), borc, alacak, aciklama, hesap_id? (tahsilat/ödemede zorunlu), olusturan_kullanici_id
- **hesap_hareket** — id, hesap_id, tarih, tur(TAHSILAT/ODEME/GELIR/GIDER/VIRMAN_GIRIS/VIRMAN_CIKIS), tutar, karsi_hesap_id? (virmanda), cari_hareket_id?, kategori, aciklama, olusturan_kullanici_id

**Akış kuralları:**
- Rezervasyon kaydedilince otomatik `KONAKLAMA_BORC` cari hareketi oluşur (cari borçlanır).
- Tahsilat girilince: cari bakiye azalır + seçilen kasa/banka bakiyesi artar (tek transaction içinde iki kayıt).
- Virman: bir hesaptan çıkış + diğerine giriş, tek transaction.

### Denetim
- **islem_logu** — id, kullanici_id, otel_id?, tarih_saat, islem_turu, tablo, kayit_id, onceki_deger(JSON), yeni_deger(JSON), aciklama
- **onay_talebi** — id, talep_eden_kullanici_id, otel_id, tur(GECMIS_TARIH_DUZELTME/KISI_SAYISI_DEGISIKLIGI/CARI_BAKIYE_DUZELTME/TAHSILAT_IPTAL/GIDER_IPTAL/REZERVASYON_SILME), hedef_tablo, hedef_kayit_id, istenen_degisiklik(JSON), durum(bekliyor/onaylandi/reddedildi), karar_veren_kullanici_id?, karar_tarihi?, karar_aciklamasi?
- Personel bu işlemleri doğrudan yapamaz → onay talebi oluşur → Admin/Süper Admin onaylar veya reddeder → sonuç loglanır.

---

## 3. Modüller ve Ekranlar (kapsamın tamamı)

### 3.1 Kimlik ve yetki
- Giriş ekranı (kullanıcı adı + şifre, "beni hatırla", şifre sıfırlama e-posta ile — SMTP ayarı yönetim panelinden)
- Rol ve otel bazlı yetki yönetimi ekranı (Süper Admin): kullanıcı × otel × işlem yetkisi matrisi
- Personel yalnızca yetkili olduğu otelleri görür; otel seçici üstte, yetkisiz oteller listede hiç görünmez

### 3.2 Otel, kat, oda, kroki
- Otel CRUD (ad, adres, iletişim), kat CRUD, oda CRUD (no, tip, kapasite, durum, açıklama)
- Oda operasyon durumu değişimi: boş / dolu / rezerve / bakımda / temizlikte
- **Kroki ekranı:** müşterinin çizimlerinden dijitalleştirilen SVG kat planı. Odalar tıklanabilir; renk = durum. Tıklanınca açılan panelde: durum, rezervasyonu yapan cari, giriş-çıkış tarihleri, kişi sayısı, toplam ücret, tahsil edilen, kalan bakiye. Basit bir kroki düzenleyici (oda kutusunu sürükle-bırak yerleştirme) yeterlidir; çizim aracı yazılmayacaktır.

### 3.3 Cari (tur şirketi/acente/firma) yönetimi
- Cari kart CRUD: ad, tür, vergi/adres, telefon, WhatsApp, e-posta, yetkililer
- Cari detay ekranı: bu ay gönderilen kişi, toplam borç, tahsil edilen, kalan bakiye, hareket ekstresi, iletişim geçmişi
- **Ara** butonu → `tel:` linki; **WhatsApp** butonu → `https://wa.me/{numara}` (yeni sekme). Otomatik mesaj gönderimi ve gelen mesaj okuma KAPSAM DIŞI — yalnızca konuşma başlatılır.
- İletişim notu ekleme (arandı / ulaşılamadı / geri dönüş bekleniyor) + tarih, saat, personel bilgisiyle geçmiş listesi

### 3.4 Kişi sayısı bazlı rezervasyon
- Form akışı: (1) Otel ve oda → (2) Giriş/çıkış tarih-saat → (3) Cari seçimi → (4) Kişi sayısı → (5) Tutar ve ödeme
- Oda listesi seçilen otele göre dolar; seçili tarihlerde dolu odalar işaretli/seçilemez gösterilir
- Gece sayısı otomatik hesaplanır; ücret toplam veya kişi başı × gece olarak girilebilir
- Çakışma: veritabanı constraint + kullanıcıya anlaşılır Türkçe hata mesajı
- Kapasite aşımı: engellemez, uyarır
- Rezervasyon listesi: filtre (otel, cari, tarih aralığı, durum), durum değişimi (giriş yapıldı / çıkış yapıldı / iptal)
- İleri tarih doluluk görünümü: takvim/çubuk görünümünde oda × tarih matrisi; otel ve cari bazlı filtre

### 3.5 Cari, kasa ve banka akışları
- Hesap tanımları: sınırsız nakit kasa ve banka hesabı (otel bazlı)
- Tahsilat ekranı: cari seç → tutar → ödeme yöntemi (nakit/havale/EFT/kart) → hesap seç → kaydet (cari düşer, hesap artar)
- Ödeme (gider) ekranı: kategori + hesap + tutar
- Virman: hesaptan hesaba transfer
- Cari ekstre: tarih, otel/oda, kişi, işlem, borç, alacak, yürüyen bakiye kolonlarıyla (kapsam raporundaki örnek tabloyla birebir aynı yapı)
- Hesap ekstresi: kasa/banka bazlı hareket listesi ve güncel bakiye

### 3.6 Log ve onay sistemi
- Loglanan işlemler: kim, ne zaman, hangi otel, işlem türü, önceki değer, yeni değer, bağlı cari/rezervasyon, açıklama
- Onaya düşen işlemler (bölüm 2'deki liste): personel talebi → yönetici kuyruğu → onay/ret + açıklama → sonuç loglanır
- Süper Admin için log görüntüleme ekranı: kullanıcı, otel, tarih, işlem türü filtreleri

### 3.7 Raporlama (tümü tarih aralığı + otel + cari filtreli, PDF ve Excel çıktılı)
- **Otel/oda:** günlük ve aylık doluluk, ileri tarih rezervasyonları, oda bazlı kişi sayısı, giriş-çıkış listeleri
- **Tur şirketi:** firmanın gönderdiği toplam kişi, otel bazlı dağılım, oda ve tarih bazlı dağılım, firma bazlı konaklama toplamı
- **Cari/finans:** cari ekstre, borç-alacak-bakiye özeti, kasa ve banka hareketleri, gelir-gider özeti
- **Denetim:** kullanıcı işlem geçmişi, değişiklik kayıtları, onaylanan/reddedilen talepler, otel bazlı aktivite
- Ana panel (dashboard): bugünkü giriş/çıkış yapacak kayıtlar (firma + kişi sayısı bazlı), genel doluluk %, kasa/banka özet bakiyeleri, haftalık gelir grafiği

### 3.8 Yönetim paneli
- Sistem ayarları, kullanıcı yönetimi, SMTP ayarları
- Veri yönetimi: manuel yedek indirme (SQL dump), otomatik günlük yedek durumu
- "Veritabanını sıfırla" YOKTUR (prod sistemde tehlikeli; yalnızca geliştirme ortamında seed komutu olarak bulunur)

---

## 4. Kapsam Dışı — YAPILMAYACAKLAR

- Bireysel misafir kaydı (ad-soyad, kimlik, pasaport), misafir geçmişi
- Evrak/doküman yönetimi modülü (fatura, sözleşme, pasaport yükleme)
- Yemek hesabı modülü
- Ayrı tedarikçi yönetimi modülü (tedarikçi yalnızca cari türüdür)
- Otomatik WhatsApp/e-posta mesaj gönderimi, gelen mesaj okuma
- Bildirim/hatırlatma motoru
- Online rezervasyon (booking) entegrasyonları, kanal yöneticisi
- Muhasebe programı entegrasyonu (ileride ayrı iş)

Codex bu listeye giren bir şey önerirse veya üretirse reddedilir.

---

## 5. Tasarım Direktifi

Referans prototipten (OtelPro) YALNIZCA fonksiyon akışı alınacak; görsel tasarım FARKLI olacaktır.

- **Yasak:** indigo/mor ağırlıklı palet, prototiple birebir aynı kart-grid yerleşimi
- **Tema:** açık zemin + koyu petrol/lacivert yan menü, tek vurgu rengi (amber veya turkuaz), nötr gri tonlar. `tokens.ts` / Tailwind config'te tanımlı tasarım tokenları; tüm ekranlar bu tokenlardan beslenir
- **Karakter:** veri-yoğun, tablo öncelikli kurumsal arayüz; süslü kartlardan çok kompakt özet şeridi + geniş tablolar
- **Ana panelin merkezi kroki görünümüdür** — sistemin görsel kimliği buradan gelir
- Tipografi: Inter veya IBM Plex Sans; Türkçe karakter testi zorunlu (İ, ı, ğ, ş, ö, ü, ç)
- Responsive: masaüstü öncelikli, tablet ve telefonda kullanılabilir (kroki mobilde yatay kaydırmalı)
- Karanlık mod: opsiyonel, token yapısı hazırlanır ama teslim kriteri değildir

---

## 6. Geliştirme Fazları (6 aylık takvimle hizalı)

### Faz 1 — Temel ve yetki (1. ay)
Proje iskeleti, Docker, Prisma şeması (TÜM tablolar baştan), migration, seed. Auth, rol yapısı, kullanıcı × otel × işlem yetki matrisi ve sunucu taraflı yetki middleware'i. Otel/kat/oda CRUD.
**Çıkış kriteri:** iki farklı personel hesabı, farklı otel yetkileriyle giriş yapıp yalnızca kendi otellerini görebiliyor; yetkisiz API çağrıları 403 dönüyor (testli).

### Faz 2 — Oda operasyonu ve kroki (2. ay)
Oda durumları, kroki bileşeni, kroki yerleştirme aracı, oda detay paneli. Personel atamaları.
**Çıkış kriteri:** krokide odaya tıklayınca doğru durum ve rezervasyon bilgisi görünüyor.

### Faz 3 — Cari ve rezervasyon (3. ay)
Cari kartlar + yetkililer, kişi sayısı bazlı rezervasyon formu, çakışma constraint'i, kapasite uyarısı, doluluk takvimi, giriş-çıkış işlemleri, otomatik cari borçlandırma.
**Çıkış kriteri:** çakışan rezervasyon DB seviyesinde engelleniyor (test); rezervasyon kaydı cari ekstresine borç olarak düşüyor.

### Faz 4 — Finans (4. ay)
Kasa/banka hesapları, tahsilat, ödeme/gider, virman, cari ekstre, hesap ekstresi. Tüm para akışları transaction içinde.
**Çıkış kriteri:** tahsilat sonrası cari bakiye + hesap bakiyesi tutarlı (test); ekstre yürüyen bakiyesi doğru.

### Faz 5 — Rapor, iletişim, log ve onay (5. ay)
Tüm rapor ekranları + PDF (Puppeteer) + Excel (exceljs) çıktıları. Ara/WhatsApp butonları, iletişim geçmişi. İşlem logları, onay kuyruğu ve akışı.
**Çıkış kriteri:** kapsam raporundaki 4 rapor grubu filtreli çalışıyor ve PDF/Excel alınabiliyor; onaya düşen 5 işlem türü uçtan uca akıyor.

### Faz 6 — Test, sertleştirme ve canlıya geçiş (6. ay)
Playwright e2e (yetki, rezervasyon, finans senaryoları), performans, yedekleme cron'u, VPS deploy, SSL, müşteri deneme ortamı, geri bildirim düzeltmeleri, kullanım kılavuzu (Türkçe, PDF).

---

## 7. Kabul Kriterleri (teslimde birebir doğrulanacak)

1. Yetkili kullanıcı yeni otel, kat, oda, personel ve cari ekleyebilmelidir.
2. Personel yalnızca yetkili olduğu otelleri görebilmelidir (UI + API seviyesinde).
3. Kroki üzerindeki odadan oda detayına ulaşılabilmelidir.
4. Rezervasyonda tur şirketi (cari), oda, tarih ve kişi sayısı tutulmalıdır.
5. Aynı oda için çakışan rezervasyon oluşturulamamalıdır (DB constraint + testi).
6. Konaklama tutarı seçilen carinin hesabına borç olarak işlenmelidir.
7. Tahsilat seçilen kasa veya banka hesabına yansımalıdır.
8. Carinin gönderdiği toplam kişi sayısı raporlanabilmelidir.
9. Arama ve WhatsApp konuşması cari kartından başlatılabilmelidir.
10. Kritik işlemler loglanmalı ve tanımlı işlemler onaya düşmelidir.

---

## 8. Codex Çalışma Kuralları

- Bu dosya repo kökünde `AGENTS.md` yanında referans olarak tutulur; her görevde kapsam bu dosyaya göre doğrulanır.
- Her faz ayrı görev olarak verilir; faz çıkış kriterleri sağlanmadan sonraki faza geçilmez.
- Her fazda: migration + kod + test + kısa CHANGELOG güncellemesi birlikte teslim edilir.
- Kapsam dışı listeye giren hiçbir özellik, "kolayken ekleyeyim" dahi olsa eklenmez.
- Para, tarih ve yetki içeren her fonksiyon için birim test yazılır.
- Tüm kullanıcıya görünen metinler Türkçedir; hata mesajları anlaşılır ve eylem önerir ("Bu oda 18–21 Temmuz arasında ABC Turizm adına dolu. Farklı tarih veya oda seçin.").
