# VisionOne Portal

Spletna aplikacija za terenskega serviserja varnostnih sistemov (videonadzor, alarmi, domofonija).
Vmesnik je v slovenščini, s preklopom na angleščino. Temen videz VisionOne.

Ta različica teče na **Vercel** (Next.js, App Router) in bere podatke iz **MySQL / MariaDB** pri Neoservu.
Datoteke gredo v **Vercel Blob** (brez žetona, v lokalnem razvoju, v mapo `.data/files`).

Aplikacija **ne trdi davčne ali bančne skladnosti**. Točke FURS, e-SLOG in UPN QR so označene za preverjanje (spodaj).

## Kaj je notri

- Stranke (oseba ali podjetje, kontakti, davčna številka, zavezanec za DDV, GPS, zemljevid)
- Objekti, oprema z gesli, šifriranimi z AES-256-GCM, IP načrt, tlorisi
- Fotografije in dokumenti, koledar, delovni nalogi (kontrolni seznam, čas, material, podpis)
- Katalog, zaloga, ponudbe, računi (DDV 22 / 9,5 / 5 / 0 %, zaporedna številka, sklic SI00, UPN QR, PDF)
- Vzdrževalne pogodbe, nadzorna plošča, iskanje, izvoz CSV, varnostna kopija ZIP, PWA
- Prijava: bcrypt, seja v piškotku `HttpOnly` + `SameSite=Strict`, glava `X-Portal` kot CSRF, omejitev neuspešnih prijav
- Ob prvi prijavi v prazno bazo nastane `admin` / `admin` z obvezno menjavo gesla

## Okoljske spremenljivke

Kopirajte `.env.example` v `.env` (lokalno) oziroma jih vpišite v Vercel → Project → Settings → Environment Variables.
Vse štiri so potrebne v produkciji:

| Spremenljivka | Namen |
| --- | --- |
| `DATABASE_URL` | Niz povezave MySQL/MariaDB. Posebne znake v geslu URL-kodirajte. Priporočilo: `connection_limit=1` (strežniška funkcija ne sme odpreti kupa povezav na deljeni gostitelj). |
| `BLOB_READ_WRITE_TOKEN` | Žeton trgovine Vercel Blob. Brez njega se datoteke shranijo lokalno v `.data/files`. |
| `ENCRYPTION_KEY` | 32 bajtov za AES-256-GCM (64 šestnajstiških znakov: `openssl rand -hex 32`). Gesla naprav, alarmne kode in WiFi. Ob menjavi ključa starih skrivnosti ni mogoče prebrati. |
| `AUTH_SECRET` | Skrivnost za podpis sejne piškotke (`openssl rand -base64 32`). |

`SEED_DEMO=1` vpliva samo na skripto `npm run db:seed`, ne na zagon aplikacije na Vercelu.

## Baza pri Neoservu

1. V nadzorni plošči Neoserv ustvarite bazo MySQL/MariaDB in uporabnika. Geslo naj bo dolgo in naključno. Zapišite si gostitelja (npr. `mysqlXX.neoserv.si`), vrata (običajno `3306`), ime baze in uporabnika.
2. V phpMyAdmin **izberite to bazo** (datoteka baze ne ustvari), zavihek **Uvoz / Import**, in naložite `sql/schema.sql`. Znakovni nabor je `utf8mb4`. Tujih ključev ni. Datoteka ne vsebuje demo podatkov.
   Enaka shema je v `prisma/migrations/20261022120000_init/migration.sql`. Obe naj ostaneta usklajeni.
3. **Oddaljeni dostop.** Vercel nima stalnega izhodnega IP naslova (razen če vključite Vercel Static IPs ali Secure Compute). V Neoservu odprite oddaljeni MySQL in dodajte dovoljene gostitelje:
   - priporočeno: statični izhodni naslovi Vercela, ko jih imate, in svoj pisarniški IP za uvoz sheme ter seme;
   - če statičnih naslovov še nimate: gostitelj `%` (katerikoli naslov). To je šibkejše. Geslo naj bo dolgo, uporabnik naj ima pravice samo na tej bazi, dostop pa izklopite, ko ga ne potrebujete.
   Brez oddaljenega dostopa prijava na visionone.si ne more prebrati baze. Povezavo preizkusite z računalnika, ki ni v omrežju Neoserva: `mysql -h GOSTITELJ -P 3306 -u UPORABNIK -p IME_BAZE`.
4. Sestavite `DATABASE_URL`:

   ```
   mysql://UPORABNIK:GESLO@GOSTITELJ:3306/IME_BAZE?connection_limit=1&connect_timeout=15&pool_timeout=15
   ```

   Če Neoserv zahteva TLS, dodajte parameter, ki ga predlaga njihova dokumentacija (pogosto `sslaccept=strict`).
5. Sheme **ne zaganjajte med gradnjo na Vercelu**. Gradnja nima stabilnega IP-ja in ne sme viseti na bazi. Uvoz v phpMyAdmin (korak 2) je dovolj. Druga možnost, z računalnika, ki sme do baze:

   ```
   npx prisma migrate deploy
   ```

6. Prvi obisk aplikacije ustvari uporabnika `admin` / `admin`, če je tabela `users` prazna, in zahteva menjavo gesla.
7. Demo podatki (samo v prazno bazo, z računalnika, ki doseže bazo):

   ```
   npm install
   npm run db:seed:demo
   ```

   Samo skrbnik, brez demo podatkov: `npm run db:seed`.

## Vercel

1. Repozitorij povežite z novim projektom na [Vercel](https://vercel.com) (GitHub → Vercel, samodejna objava ob vsakem potisu na `main`). Ogrodje: **Next.js**. Korenski imenik: koren repozitorija. Ukaz za gradnjo: `npm run build` (že v `package.json`: `prisma generate && next build`). Ne dodajajte `prisma migrate deploy` v ukaz za gradnjo.
2. Pred prvo objavo vpišite `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ENCRYPTION_KEY` in `AUTH_SECRET` za okolje Production (in Preview, če želite predogled).
3. Shramba datotek: Vercel → Storage → Blob → povežite trgovino s projektom. Vercel sam doda `BLOB_READ_WRITE_TOKEN`. Datoteke do približno 3,5 MB gredo skozi funkcijo; večje gredo neposredno v Blob (strežniška funkcija ima omejitev telesa zahteve okoli 4,5 MB).
4. Objavite. Preverite `https://<projekt>.vercel.app/api/health` (odgovor `{"ok":true}`) in prijavo. Pot za PDF ima `maxDuration` 60 s; na načrtu Hobby jo Vercel lahko omeji na 10 s. Navaden račun se izriše prej.

Lokalni razvoj:

```
cp .env.example .env
npm install
npm run dev
```

Potrebujete dosegljiv MySQL/MariaDB in uvoženo `sql/schema.sql`. Testi (`npm test`) pričakujejo MariaDB na `127.0.0.1:3306`, uporabnika `portal` / `portal` in sami ustvarijo bazo `portal_test`.

## Domena visionone.si

1. V projektu Vercel: Settings → Domains → dodajte `visionone.si` in `www.visionone.si`.
2. V DNS pri Neoservu (ali kjer je cona za visionone.si) nastavite zapise, ki jih pokaže Vercel. Običajno:
   - `visionone.si` — zapis **A** na `76.76.21.21`
   - `www.visionone.si` — zapis **CNAME** na `cname.vercel-dns.com`
3. Počakajte, da Vercel izda potrdilo. Aplikacija piškotek označi kot `Secure` samo prek HTTPS.
4. Če Vercel v vmesniku pokaže druge naslove, uporabite tiste. Vrednosti zgoraj so izhodišče, ne zamenjava za navodilo v nadzorni plošči.

## Varnostna kopija

ZIP iz nastavitev vsebuje `data.json` (tabele, šifrirana gesla ostanejo z predpono `enc:`) in lokalne datoteke. **`ENCRYPTION_KEY` v ZIP ni.** Shranite ga ločeno. Datoteke v Vercel Blob ostanejo v shrambi Blob; v ZIP se prepišejo samo lokalne datoteke. CSV izvoz ne vsebuje gesel.

## Pravno — za preverjanje

Aplikacija tega **ne izvaja** in **ne trdi skladnosti**:

- **Davčno potrjevanje računov (FURS, ZDavPR).** Ni ZOI, ni EOR, ni certifikata in ni prijave poslovnega prostora. Gotovinska in kartična plačila v Sloveniji praviloma zahtevajo certificirano davčno blagajno, dokler ta del ni posebej narejen in preverjen.
- Sestavine računa po ZDDV-1 so izpisane na PDF. Ustreznost naj potrdi računovodja. Stopnje DDV so 22, 9,5, 5 in 0 odstotkov.
- **e-račun / e-SLOG** ni podprt.
- **UPN QR:** polja in kontrolna vsota po specifikaciji ZBS, vsebina v ISO-8859-2. Oznaka ECI in fiksna različica QR 15 **nista nastavljeni** (knjižnica izbere velikost sama). Kodo pred uporabo preverite v bančni aplikaciji. Sklic SI00 je iz številke računa, brez kontrolne številke.
- Račune hranite 10 let (redne kopije). V bazi so osebni podatki strank in fotografije (GDPR).

## Preizkusi

```
npm test
npm run build
```
