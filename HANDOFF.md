# EDGECO Office — Handoff für Codex

Kurzer Kontext, um nahtlos weiterzumachen. Letzter Stand: **Phase 4 Basis umgesetzt**, als Nächstes **Shopify Admin-API / Import-Verfeinerung**.

## Was das ist
Selbst gebaute **EÜR-Buchhaltung** für ein Kleinunternehmen (§19 UStG, keine USt) — 3D-Druck/Stunt-Teile. Web-App, von Handy + Laptop nutzbar.

- **Live:** https://edgeco-office.de (eigene Domain via Vercel; Auto-Deploy bei jedem `git push origin master`)
- **Repo:** https://github.com/Toostiii/edgeco-office (Branch `master`, solo → direkt committen, kein PR)

## Stack
Next.js 16 (App Router, TS) · React 19 · Tailwind v4 · **Drizzle ORM** + **Supabase Postgres** (EU-Frankfurt) · Supabase Auth (1 User) · Supabase Storage (Bucket `belege`) · pdf-lib · Vitest · Deploy auf Vercel.

## Setup / Befehle
- `.env.local` enthält `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (vorhanden, nicht im Repo).
- `npm run dev` · `npm test` · `npm run build`
- DB: `npm run db:generate` → `db:migrate` → `db:seed` · `db:setup-storage` (Storage-RLS) · `db:secure` (RLS auf allen Tabellen)
- Migrationen werden mit `drizzle-kit generate` aus `db/schema.ts` erzeugt — Schema-Änderung = generate + migrate.

## Wichtige Konventionen (unbedingt einhalten)
- **Geld immer in Cent (Integer).** Anzeige: `formatEuro()`, Eingabe-Parsing: `parseEuroToCents()` (beide in `lib/money.ts`).
- **Geldrelevante Logik bekommt Vitest-Tests** (siehe `lib/calc/*.test.ts`). TDD bevorzugt.
- **Pro Feature:** `app/(app)/<feature>/page.tsx` (Server Component, `export const dynamic = "force-dynamic"`) + `actions.ts` (`"use server"`) + Client-Form in `components/`.
- **Mutations** = Server Actions mit `useActionState`-Signatur `(prev, formData)`. Auth via `requireUserId()` (Supabase `getUser()`), jede Zeile trägt `ownerId`.
- **Validierung** mit Zod in `lib/validation/`.
- **Nav freischalten:** in `components/AppShell.tsx` das NAV-Item auf `ready: true` setzen (sonst ausgegraut).
- **Route-Handler** (z. B. PDF) sind NICHT vom `(app)/layout.tsx` geschützt → Auth-Check selbst einbauen (siehe `app/(app)/invoices/[id]/pdf/route.ts`).
- **GoBD-Haltung:** aktuell hartes Löschen/Bearbeiten erlaubt (frische Eingaben). Geplant: „Festschreibung" beim Jahresabschluss sperrt abgeschlossene Jahre.
- DB-Zugriff läuft über privilegierte `DATABASE_URL` (umgeht RLS); RLS ist aktiv, um die öffentliche Supabase-REST-API zu sperren.

## Datenmodell (`db/schema.ts`)
`transactions` (Einnahmen/Ausgaben, Cent, `direction`, optional `categoryId`/`receiptId`/`invoiceId`/`assetId`) · `categories` · `receipts` · `customers` · `assets` (AfA) · `invoices` + `invoice_items` · `company_profile` (Stammdaten + `nextInvoiceNo`).

## Status
- ✅ **Phase 0** Fundament, Auth, Dashboard
- ✅ **Phase 1** Einnahmen/Ausgaben (`/transactions`) + Belege (`/receipts`, Upload+Galerie+Löschen) + Bearbeiten/Löschen
- ✅ **Phase 2** Kunden (`/customers`), Einstellungen (`/settings`), Rechnungen (`/invoices`): erstellen, Positionen, fortlaufende Nr. `RE-JJJJ-NNNN`, **PDF** (`lib/pdf/invoice-pdf.ts`), Status Entwurf/Versendet/Bezahlt, **„bezahlt" legt automatisch Einnahme an**
- ✅ **Phase 3** Anlagen (`/assets`) mit CRUD + AfA-Plan, Auswertungen (`/reports`) mit Jahresfilter, Kategorie-/Monatsübersicht, AfA-Abzug und CSV-Export. Dashboard rechnet AfA nun in den EÜR-Gewinn ein.
- ✅ **Phase 4 Basis** Shopify-Import (`/shopify`) per CSV/JSON mit Vorschau, Deduplizierung über `[shopify:<id>]`, Kategorie „Verkauf Teile (Shopify)" und Buchung als Einnahme.
- ✅ **OCR** Beleg → Buchung: `tesseract.js` im Browser, `lib/ocr/parse-receipt.ts` (Betrag/Datum), Galerie-Button leitet mit Prefill zu `/transactions`.
- ✅ **Mobile** Hamburger-Menü in `components/AppShell.tsx` (Desktop = Sidebar, mobil = Drawer).
- ✅ **Sicherheit & Steuer** Voll-Backup-Export (`/export`, JSON, in Einstellungen). GoBD-**Festschreibung**: Tabelle `fiscalLocks`, Helper `lib/fiscal.ts` (`isYearLocked`/`getLockedYears`/`yearOf`), Lock-Actions `app/(app)/reports/lock-actions.ts`, UI `components/YearLockControl.tsx` in `/reports`. Erzwungen in `transactions/actions.ts` (create/update/delete) + `invoices` „bezahlt". **Hinweis:** Shopify-Import erzwingt die Sperre noch NICHT.

## NÄCHSTES: Shopify Admin-API / Import-Verfeinerung
0. (Optional) Festschreibung auch im Shopify-Import erzwingen (gesperrte Jahre überspringen).
1. Shopify Admin-API anbinden (`SHOPIFY_SHOP_DOMAIN`, Admin Access Token) und Bestellungen automatisch abrufen.
2. Import-Vorschau um Auswahl pro Bestellung, Refund-/Fee-Behandlung und Netto-/Brutto-Felder erweitern.
3. Optional: Importläufe dauerhaft protokollieren statt nur per Transaktionsmarker zu deduplizieren.

## Verifikation
`npm test` grün halten · `npm run build` muss durchlaufen · neue Seiten lokal mit `npm run dev` prüfen · PDF lässt sich isoliert testen, indem man `generateInvoicePdf()` mit Beispieldaten aufruft und die Bytes in eine Datei schreibt.
