# EDGECO Office — Einrichtung

Schritt-für-Schritt, um die App lokal lauffähig zu machen. Du brauchst nur ein
kostenloses **Supabase**-Konto. Geschätzte Zeit: ~15 Minuten.

---

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) registrieren / einloggen.
2. **New project** anklicken.
   - **Name:** `edgeco-office`
   - **Database Password:** ein starkes Passwort wählen → **notieren!**
   - **Region:** **Central EU (Frankfurt)** — wichtig wegen Datenschutz/DSGVO.
3. Projekt erstellen lassen (dauert ~2 Min).

## 2. Zugangsdaten kopieren

In `.env.example` zu **`.env.local`** kopieren und folgende Werte eintragen:

- **Settings → API**
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon` `public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Settings → Database → Connection string → "Transaction pooler" (Port 6543)**
  - Den String → `DATABASE_URL`
  - `[YOUR-PASSWORD]` im String durch dein Datenbank-Passwort aus Schritt 1 ersetzen.

```bash
# im Projektordner
cp .env.example .env.local
# danach .env.local mit deinen Werten ausfüllen
```

## 3. Datenbankschema anlegen (Migrationen)

```bash
npm run db:generate   # erzeugt SQL-Migrationen aus dem Drizzle-Schema
npm run db:migrate    # spielt sie in deine Supabase-DB ein
npm run db:seed       # legt Standard-Kategorien + Firmenprofil an
```

> Prüfen: In Supabase unter **Table Editor** sollten jetzt die Tabellen
> (`transactions`, `categories`, `invoices`, …) sichtbar sein.

## 4. Login-Benutzer anlegen

Da nur du die App nutzt, legen wir genau einen Benutzer an:

- **Authentication → Users → Add user → Create new user**
- E-Mail + Passwort eingeben, **"Auto Confirm User"** aktivieren.

## 5. Storage-Bucket für Belege

- **Storage → New bucket**
  - Name: `belege`
  - **Private** (nicht öffentlich).

## 6. App starten

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) öffnen, auf **Anmelden** klicken,
mit dem Benutzer aus Schritt 4 einloggen.

---

## Nützliche Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm test` | Berechnungs-Tests (EÜR/AfA) |
| `npm run db:studio` | Drizzle Studio (DB im Browser ansehen) |
| `npm run build` | Produktions-Build (vor Vercel-Deploy) |

## Deploy auf Vercel (später, Phase 0-Abschluss)

1. Projekt auf GitHub pushen.
2. Auf [vercel.com](https://vercel.com) importieren.
3. Dieselben drei Umgebungsvariablen aus `.env.local` in Vercel hinterlegen.
4. Deploy. Fertig — von überall erreichbar.
