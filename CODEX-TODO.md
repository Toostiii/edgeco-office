# CODEX-TODO — Offene Punkte EDGECO Office

> Handoff-Dokument für den **Codex**-Agenten. Stand: **2026-06-03**.
> **Zuerst `AGENTS.md` lesen:** Die Next.js-Version (16.2.7, App Router, Turbopack)
> weicht teils von Trainingsdaten ab — relevante Guides liegen unter
> `node_modules/next/dist/docs/`. Im Zweifel dort nachschlagen, bevor du Code schreibst.

---

## Projekt-Kontext in 60 Sekunden

**EDGECO Office** = selbst gebaute EÜR-Buchhaltung für ein Einzelunternehmen
(Kleinunternehmer §19 UStG, 3D-Druck/Stunt-Teile). Ein einziger Inhaber als Nutzer.

**Stack:** Next.js (TS, App Router) · Supabase (Postgres + Auth + Storage, EU-Frankfurt)
· Drizzle ORM · pdf-lib · Vercel. Produktions-Branch ist `master` (Auto-Deploy).

**Steuerlicher Rahmen (prägt das Datenmodell):**
- EÜR nach Zufluss-/Abflussprinzip, **keine** Umsatzsteuer auf Rechnungen (§19).
- **GoBD:** gebuchte Daten werden nicht gelöscht, sondern storniert
  (`transactions.status = 'cancelled'`); festgeschriebene Jahre (`fiscal_locks`) sind gesperrt.
- **AfA:** lineare, monatsgenaue Abschreibung > 800 € (`lib/calc/afa.ts`).
- **Geld immer in Cent (Integer)** — nie Floats. Anzeige via `lib/money.ts`.

**Code-Konventionen / Patterns (an bestehenden Dateien orientieren):**
- **Server Actions:** `app/(app)/<feature>/actions.ts`, jede Action ruft `requireUserId()`,
  validiert mit einem Zod-Schema aus `lib/validation/`, und ruft am Ende `revalidatePath(...)`.
  Vorlage: `app/(app)/customers/actions.ts`.
- **Formulare:** Client-Components mit `useActionState`. Vorlage: `components/CustomerForm.tsx`.
- **Route Handler** (`route.ts`) sind **nicht** vom `(app)`-Layout geschützt → eigene
  Auth-Prüfung via `createClient()` + `supabase.auth.getUser()`. Vorlage:
  `app/(app)/invoices/[id]/pdf/route.ts`.
- **DB-Scoping:** alles über `ownerId` filtern. Geteilte Seed-Kategorien haben `ownerId = NULL`.
- **DB-Schema:** `db/schema.ts`. Bei Schema-Änderungen: `npm run db:generate` → `npm run db:migrate`
  (oder `db:push` in Dev). **Nur** anfassen, wenn nötig.

**Quality-Gates vor jedem Commit/PR (alle müssen grün sein):**
```bash
npm run lint
node node_modules/typescript/bin/tsc --noEmit   # NICHT `npx tsc` (zieht falsches Paket)
npm test
npm run build                                    # benötigt DATABASE_URL (Dummy reicht, DB-Calls sind lazy)
```

---

## ✅ Bereits erledigt — NICHT erneut umsetzen (Commit `da533ad`)

- **Kategorien-Verwaltung** (CRUD): `app/(app)/categories/`, `components/CategoryForm.tsx`,
  `components/CategoryDeleteButton.tsx`, `lib/validation/category.ts`.
- **EÜR-PDF-Export:** `lib/pdf/eur-pdf.ts` + `app/(app)/reports/pdf/route.ts` (Button in `reports/page.tsx`).
- **Dashboard-Ausbau:** zusätzliche KPIs + Schnellzugriff in `app/(app)/dashboard/page.tsx`.

---

## 🔴 Offen — hohe Priorität

### 1. E-Mail-Versand von Rechnungen
**Ist-Zustand:** `setInvoiceStatus(id, 'sent')` in `app/(app)/invoices/actions.ts` setzt nur
den Status. Das PDF wird unter `app/(app)/invoices/[id]/pdf/route.ts` (Generator
`lib/pdf/invoice-pdf.ts`) erzeugt. Kein Mailversand. Kunden haben bereits ein optionales
`email`-Feld (`customers.email`).

**Soll:** Rechnung als PDF-Anhang an den hinterlegten Kundenkontakt mailen; nach Erfolg Status
automatisch auf `sent` setzen.

**Schritte:**
1. Provider wählen — **Resend empfohlen** (kostengünstig, simple API), Env: `RESEND_API_KEY`.
2. `lib/mail/send.ts` (Versand-Helfer, Absender aus `companyProfile`).
3. PDF-Bytes wiederverwenden: `generateInvoicePdf(...)` aus `lib/pdf/invoice-pdf.ts`
   (nicht über die HTTP-Route, sondern direkt aufrufen).
4. Neue Server Action `sendInvoiceByEmail(id)` in `invoices/actions.ts`
   (Auth + `ownerId`-Scope + GoBD: bei festgeschriebenem Jahr ggf. trotzdem erlauben, da reiner Versand).
5. Button in `components/InvoiceActions.tsx`; nur aktiv, wenn `customer.email` gesetzt ist.

**Akzeptanz:** Klick auf „Per E-Mail senden" verschickt das korrekte PDF, Status springt auf
`sent`, Fehler (kein Key / keine E-Mail) werden sauber als `ActionState.error` zurückgegeben.

**Braucht vom Inhaber:** `RESEND_API_KEY` (oder SMTP-Zugang) + verifizierte Absender-Domain.

---

### 2. Shopify Auto-Sync (Roadmap P4 — zweite Stufe)
**Ist-Zustand:** Manueller Import per CSV/JSON (Upload oder Einfügen) mit Vorschau und
Dedup. Logik: `lib/import/shopify.ts`, Actions: `app/(app)/shopify/actions.ts`.
Dedup läuft über einen Marker in `transactions.description` (`shopifyMarker`/`extractShopifyMarker`),
Import nur bei bezahltem Status (`isImportableShopifyStatus`).

**Soll:** Neue bezahlte Bestellungen automatisch als Einnahme buchen — ohne manuellen Export.

**Schritte:**
1. Shopify Admin API Token als Env (`SHOPIFY_STORE`, `SHOPIFY_ADMIN_TOKEN`).
2. Fetch-Layer `lib/import/shopify-api.ts`, der Orders → `ShopifyImportOrder` mappt
   (Mapping/Validierung aus `lib/import/shopify.ts` wiederverwenden).
3. Trigger wählen:
   - **Vercel Cron** (`vercel.json` + `app/api/shopify/sync/route.ts`, mit `CRON_SECRET`-Check), **oder**
   - **Webhook** `app/api/shopify/webhook/route.ts` mit **HMAC-Signaturprüfung** (`SHOPIFY_WEBHOOK_SECRET`).
4. **Idempotenz/Dedup unbedingt beibehalten** (gleicher Marker-Mechanismus) → kein Doppel-Buchen.

**Akzeptanz:** Ein neuer bezahlter Testauftrag erscheint nach dem Sync als Einnahme,
ein zweiter Lauf erzeugt keine Dublette.

**Braucht vom Inhaber:** Shopify Admin API Token + (bei Webhook) Webhook-Secret.

---

## 🟡 Offen — mittlere Priorität

### 3. Tests für neue Logik
Bestehende Tests liegen als `lib/**/*.test.ts` (vitest). Es fehlen:
- **Smoke-Test für `lib/pdf/eur-pdf.ts`** — `generateEurPdf(...)` mit Beispieldaten (inkl. Umlauten/§)
  liefert Bytes mit `%PDF-`-Header und wirft nicht.
- Optional: Test für die Kategorie-Aufschlüsselung in `app/(app)/reports/pdf/route.ts`
  (Logik ggf. in eine reine Funktion auslagern, dann testbar).

### 4. EÜR-PDF näher an die amtliche „Anlage EÜR"
Aktuell ist das PDF eine klar strukturierte, aber **freie** Auswertung. Optional: Mapping auf die
amtlichen Zeilen/Kennzahlen der Anlage EÜR, damit es 1:1 zur Steuererklärung passt.

---

## 🟢 Nice-to-have / Ideen

- **Unverbuchte Belege** sichtbar machen (Dashboard-KPI + Filter auf `/receipts`):
  Belege ohne verknüpfte `transactions.receiptId`.
- **Wiederkehrende Buchungen** (z. B. monatliche Softwarekosten) als Vorlagen.
- **Mehrjahres-Vergleich** in `/reports` (Vorjahr vs. aktuelles Jahr).
- **Backup-Restore**: Gegenstück zum JSON-Export (`app/(app)/export/route.ts`).

---

## Definition of Done (pro Aufgabe)

- [ ] `ownerId`-Scoping in allen Queries; Auth in Actions **und** Route Handlern geprüft.
- [ ] Beträge in Cent; GoBD-Regeln respektiert (kein Hard-Delete gebuchter Daten, gesperrte Jahre beachten).
- [ ] Zod-Validierung der Eingaben; Fehler als `ActionState.error` (deutsch) zurückgeben.
- [ ] Secrets nur über Env-Variablen (in Vercel hinterlegen, nicht committen).
- [ ] `npm run lint`, `tsc --noEmit`, `npm test`, `npm run build` lokal grün.
- [ ] Commit auf Feature-Branch + PR; `master` deployt automatisch.
