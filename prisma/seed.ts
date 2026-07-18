import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

function seedIban(hotelId: number) {
  return `TR${String(10 + hotelId).padStart(2, "0")}000100000000000000000${hotelId}`;
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const sirket = await tx.sirket.upsert({
      where: { id: 1 },
      update: { ad: "OYS Turizm A.Ş." },
      create: { id: 1, ad: "OYS Turizm A.Ş." }
    });

    const hotelNames = ["Mavi Kıyı Otel", "Petrol Park Otel", "Anka Şehir Otel"];
    const hotels = [];
    for (const [index, ad] of hotelNames.entries()) {
      const hotel = await tx.otel.upsert({
        where: { id: index + 1 },
        update: { ad, sirketId: sirket.id, aktifMi: true, silindiMi: false },
        create: {
          id: index + 1,
          sirketId: sirket.id,
          ad,
          adres: `${index + 1}. Cadde No:${10 + index}`,
          telefon: `0212 555 0${index + 1}0${index + 1}`,
          eposta: `info${index + 1}@oys.local`
        }
      });
      hotels.push(hotel);

      for (let floorIndex = 1; floorIndex <= 2; floorIndex += 1) {
        const floor = await tx.kat.upsert({
          where: { otelId_ad: { otelId: hotel.id, ad: `${floorIndex}. Kat` } },
          update: { sira: floorIndex },
          create: { otelId: hotel.id, ad: `${floorIndex}. Kat`, sira: floorIndex }
        });

        for (let roomIndex = 1; roomIndex <= 5; roomIndex += 1) {
          const odaNo = `${floorIndex}${String(roomIndex).padStart(2, "0")}`;
          await tx.oda.upsert({
            where: { otelId_odaNo: { otelId: hotel.id, odaNo } },
            update: { katId: floor.id, aktifMi: true, silindiMi: false },
            create: {
              otelId: hotel.id,
              katId: floor.id,
              odaNo,
              odaTipi: roomIndex === 5 ? "Aile" : "Standart",
              kapasite: roomIndex === 5 ? 4 : 2,
              aciklama: "Seed oda kaydı"
            }
          });
        }
      }

      await tx.hesap.upsert({
        where: { otelId_ad: { otelId: hotel.id, ad: "Resepsiyon Kasası" } },
        update: { aktifMi: true },
        create: { otelId: hotel.id, tur: "NAKIT_KASA", ad: "Resepsiyon Kasası" }
      });
      await tx.hesap.upsert({
        where: { otelId_ad: { otelId: hotel.id, ad: "Ana Banka Hesabı" } },
        update: { aktifMi: true },
        create: {
          otelId: hotel.id,
          tur: "BANKA",
          ad: "Ana Banka Hesabı",
          bankaAdi: "Ziraat Bankası",
          iban: seedIban(hotel.id)
        }
      });
    }

    const superAdmin = await tx.kullanici.upsert({
      where: { kullaniciAdi: "superadmin" },
      update: { aktifMi: true },
      create: {
        adSoyad: "Süper Admin",
        kullaniciAdi: "superadmin",
        sifreHash: await hashPassword("SuperAdmin123!"),
        rol: "SUPER_ADMIN"
      }
    });
    const admin = await tx.kullanici.upsert({
      where: { kullaniciAdi: "admin" },
      update: { aktifMi: true },
      create: {
        adSoyad: "Otel Admin",
        kullaniciAdi: "admin",
        sifreHash: await hashPassword("Admin123!"),
        rol: "ADMIN"
      }
    });
    const personelA = await tx.kullanici.upsert({
      where: { kullaniciAdi: "personel.a" },
      update: { aktifMi: true },
      create: {
        adSoyad: "Personel A",
        kullaniciAdi: "personel.a",
        sifreHash: await hashPassword("Personel123!"),
        rol: "PERSONEL"
      }
    });
    const personelB = await tx.kullanici.upsert({
      where: { kullaniciAdi: "personel.b" },
      update: { aktifMi: true },
      create: {
        adSoyad: "Personel B",
        kullaniciAdi: "personel.b",
        sifreHash: await hashPassword("Personel123!"),
        rol: "PERSONEL"
      }
    });

    for (const hotel of hotels) {
      await tx.kullaniciOtelYetkisi.upsert({
        where: { kullaniciId_otelId: { kullaniciId: admin.id, otelId: hotel.id } },
        update: {},
        create: {
          kullaniciId: admin.id,
          otelId: hotel.id,
          rezervasyonYetkisi: "TAM",
          cariYetkisi: "TAM",
          finansYetkisi: "TAM",
          raporYetkisi: "TAM"
        }
      });
    }

    await tx.kullaniciOtelYetkisi.upsert({
      where: { kullaniciId_otelId: { kullaniciId: personelA.id, otelId: hotels[0].id } },
      update: {},
      create: {
        kullaniciId: personelA.id,
        otelId: hotels[0].id,
        rezervasyonYetkisi: "EKLE",
        cariYetkisi: "GORUNTULE",
        finansYetkisi: "YOK",
        raporYetkisi: "GORUNTULE"
      }
    });
    await tx.kullaniciOtelYetkisi.upsert({
      where: { kullaniciId_otelId: { kullaniciId: personelB.id, otelId: hotels[1].id } },
      update: {},
      create: {
        kullaniciId: personelB.id,
        otelId: hotels[1].id,
        rezervasyonYetkisi: "GORUNTULE",
        cariYetkisi: "TAHSILAT",
        finansYetkisi: "GORUNTULE",
        raporYetkisi: "YOK"
      }
    });

    const cariList = [
      ["ABC Turizm", "TUR_SIRKETI"],
      ["Kuzey Acente", "ACENTE"],
      ["Deniz Kurumsal", "KURUMSAL"]
    ] as const;
    for (const [ad, tur] of cariList) {
      await tx.cari.upsert({
        where: { id: cariList.findIndex((item) => item[0] === ad) + 1 },
        update: { ad, tur },
        create: {
          id: cariList.findIndex((item) => item[0] === ad) + 1,
          ad,
          tur,
          telefon: "0212 555 44 33",
          whatsapp: "905325554433",
          eposta: `${ad.toLocaleLowerCase("tr-TR").replaceAll(" ", ".")}@example.local`
        }
      });
    }

    await tx.islemLogu.create({
      data: {
        kullaniciId: superAdmin.id,
        islemTuru: "SEED",
        tablo: "Sistem",
        kayitId: 1,
        yeniDeger: { otel: hotels.length },
        aciklama: "Faz 1 seed verisi oluşturuldu."
      }
    });

    await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Sirket"', 'id'), COALESCE((SELECT MAX(id) FROM "Sirket"), 1), true)`);
    await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Otel"', 'id'), COALESCE((SELECT MAX(id) FROM "Otel"), 1), true)`);
    await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Cari"', 'id'), COALESCE((SELECT MAX(id) FROM "Cari"), 1), true)`);
  }, { timeout: 30000 });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
