# EDGECO Accounting Audit

Stand: 2026-06-03  
Scope: aktueller Arbeitsstand im Repository `edgeco-office` unter `D:\EDGECO\edgeco-office`  
Hinweis: Diese Analyse bewertet die technische Umsetzung. Steuerliche und rechtliche Einordnung sollte bei kritischen Entscheidungen mit Steuerberater/Inhaber abgeglichen werden.

## Zusammenfassung

EDGECO Office ist eine Next.js-16-App-Router-Anwendung fuer eine private EÜR-Buchhaltung eines einzelnen Inhabers. Der vorhandene Kern ist fuer eine Solo-App bereits brauchbar: Supabase Auth ist integriert, Buchungen/Kunden/Rechnungen/Belege/Anlagen/Reports existieren, Geld wird als Cent-Integer gerechnet, zentrale Rechenlogik ist gut isoliert und mit Vitest abgedeckt. PDF- und Mail-Logik sind vorhanden, Shopify ist sowohl als manueller Import als auch als Cron-basierter Admin-API-Sync angelegt.

Die groessten technischen Risiken liegen nicht in der UI, sondern in Datenintegritaet, Zugriffsscopes und GoBD-naher Persistenz:

- Mehrere Server Components lesen personenbezogene oder buchhalterische Daten ohne `ownerId`-Filter, obwohl der DB-Zugriff serverseitig ueber `DATABASE_URL` RLS umgeht.
- Rechnungen, Buchungen, Belege und Anlagen koennen hart geloescht oder entkoppelt werden; Storno-/Audit-Logik ist nur teilweise als Statusfeld vorbereitet.
- Gesendete Rechnungen werden nicht eingefroren: Das PDF wird bei Abruf neu generiert, `pdfPath` wird nicht genutzt, es gibt kein `sentAt`, keinen Mail-Log und keine unveraenderliche PDF-Kopie.
- Rechnungsnummern sind nur ueber `company_profile.nextInvoiceNo` gesteuert. Es gibt keinen Unique-Constraint, keine sichere Zeilensperre und die Nummer kann in den Einstellungen manuell zurueckgesetzt werden.
- Shopify-Import ist idempotent ueber Textmarker, aber ohne DB-Unique-Constraint/Transaktion bei parallelen Importen nicht race-sicher und ohne Gebuehren-/Refund-/Steuer-/Versandmodell.
- GoBD-nahe Anforderungen sind sichtbar begonnen (Jahreslock, Hash bei Belegen, `cancelled`-Status), aber noch nicht konsequent in allen Mutationen, Exports und Loeschpfaden durchgesetzt.

Verifikation:

- `npm run lint`: erfolgreich
- `node node_modules/typescript/bin/tsc --noEmit`: erfolgreich
- `npm test`: erfolgreich, 10 Testdateien, 45 Tests
- `npm run build`: ohne `DATABASE_URL` erwartbar fehlgeschlagen bei `/export`; mit Dummy-`DATABASE_URL` erfolgreich

## Projektstruktur

### Router und Routen

- App Router wird verwendet. Es gibt keine `pages/`-Struktur.
- Oeffentliche Seiten:
  - `app/page.tsx`
  - `app/login/page.tsx`
- Geschuetzter App-Bereich:
  - `app/(app)/layout.tsx` prueft den eingeloggten Nutzer und redirectet nach `/login`.
  - Feature-Seiten liegen konsistent unter `app/(app)/<feature>/page.tsx`.
- Route Handler:
  - `app/(app)/export/route.ts`
  - `app/(app)/reports/export/route.ts`
  - `app/(app)/reports/pdf/route.ts`
  - `app/(app)/invoices/[id]/pdf/route.ts`
  - `app/api/shopify/sync/route.ts`
- Server Actions:
  - `app/(app)/transactions/actions.ts`
  - `app/(app)/customers/actions.ts`
  - `app/(app)/categories/actions.ts`
  - `app/(app)/receipts/actions.ts`
  - `app/(app)/invoices/actions.ts`
  - `app/(app)/assets/actions.ts`
  - `app/(app)/settings/actions.ts`
  - `app/(app)/reports/lock-actions.ts`
  - `app/(app)/shopify/actions.ts`

Bewertung: Die Struktur ist fuer eine kleine interne App sauber und nachvollziehbar. App Router, Server Actions, Route Handler, Client-Formulare und Domain-Helfer sind erkennbar getrennt.

### Komponentenstruktur

Vorhandene Muster:

- Client-Formulare in `components/`, z. B. `TransactionForm`, `InvoiceForm`, `CustomerForm`, `ReceiptUpload`.
- Server Actions pro Feature in `app/(app)/<feature>/actions.ts`.
- Reine Fachlogik in `lib/calc`, `lib/import`, `lib/pdf`, `lib/mail`, `lib/ocr`, `lib/validation`.
- DB-Schema und DB-Client in `db/schema.ts` und `db/index.ts`.

Positiv:

- Geld-, EÜR-, AfA-, Invoice-, OCR-, Shopify-, PDF- und Mail-Logik sind weitgehend als reine oder gut testbare Module isoliert.
- Zod-Validierung ist fuer zentrale Formulare vorhanden.
- UI-Komponenten sind fuer die Groesse der App ausreichend wiederverwendbar.

Schwaechen:

- `requireUserId()` ist in vielen Actions dupliziert statt zentral exportiert.
- Teilweise lesen Server Components direkt aus der DB ohne gemeinsamen Zugriffslayer, wodurch `ownerId`-Filter uneinheitlich sind.
- Firmenprofil wird global gelesen/geschrieben, nicht konsequent pro `ownerId`.
- Kritische Regeln wie Jahreslock, GoBD-Loeschverbot, Invoice-Statusuebergaenge und PDF-Festschreibung sind nicht als zentrale Business-Services gekapselt.

## Datenbank und ORM

Es wird Drizzle ORM verwendet, nicht Prisma. Das relevante Schema liegt in `db/schema.ts`, Migrationen in `db/migrations/`.

### Vorhandene Tabellen

- `company_profile`
- `categories`
- `receipts`
- `customers`
- `assets`
- `invoices`
- `invoice_items`
- `transactions`
- `fiscal_locks`

### Positiv

- Geldwerte sind `integer` in Cent, z. B. `transactions.amount`, `invoices.total`, `invoice_items.unit_price`, `assets.cost`.
- Status-Enums existieren:
  - `booking_status`: `posted`, `cancelled`
  - `invoice_status`: `draft`, `sent`, `paid`, `cancelled`
- Rechnungspositionen sind per FK an Rechnungen gebunden.
- `fiscal_locks` ist als Grundlage fuer Jahres-Festschreibung vorhanden.
- Migrationen existieren: `db/migrations/0000_broken_meteorite.sql`, `db/migrations/0001_omniscient_tinkerer.sql`.

### Kritische Luecken

- `ownerId` ist in allen relevanten Tabellen nullable, z. B. `db/schema.ts:36`, `db/schema.ts:54`, `db/schema.ts:63`, `db/schema.ts:73`, `db/schema.ts:83`, `db/schema.ts:96`, `db/schema.ts:122`, `db/schema.ts:141`.
- Es gibt keine expliziten Indizes auf haeufige Filter:
  - `owner_id`
  - `date`
  - `invoice_id`
  - `receipt_id`
  - `category_id`
  - `asset_id`
  - `fiscal_locks(owner_id, year)`
- Es gibt keinen Unique-Constraint fuer Rechnungsnummern. `invoices.number` ist nur `notNull` (`db/schema.ts:97`).
- `fiscal_locks` hat keinen Unique-Constraint auf `(owner_id, year)`.
- `company_profile.nextInvoiceNo` (`db/schema.ts:42`) ist global und manuell aenderbar.
- `invoices.pdfPath` ist vorhanden (`db/schema.ts:103`), wird aber nicht beschrieben.
- Es gibt kein Audit-Log/History-Modell.
- Es gibt kein Export-Log und keine Restore-Tabelle/Restore-Routine.

Empfehlung: Fuer den naechsten Datenbankausbau sollten Unique-Constraints und Indizes zuerst kommen, danach Audit- und Dokumentenarchivtabellen.

## Authentifizierung und Zugriffsschutz

### Vorhanden

- Login per Supabase Auth in `app/login/page.tsx`.
- Session-Refresh in `proxy.ts`.
- App-Layout prueft den Nutzer in `app/(app)/layout.tsx`.
- Viele Server Actions rufen `requireUserId()` auf.
- Route Handler pruefen ueberwiegend explizit `supabase.auth.getUser()`.
- `db/secure-rls.ts` aktiviert RLS fuer App-Tabellen, bewusst ohne Policies, weil die App ueber `DATABASE_URL` serverseitig zugreift.

### Kritische Zugriffsluecken

Da Drizzle ueber `DATABASE_URL` serverseitig arbeitet, muss jede Query selbst nach `ownerId` filtern. Das passiert nicht ueberall.

Beispiele ohne `ownerId`-Filter:

- Buchungen-Seite:
  - Kategorien: `app/(app)/transactions/page.tsx:42`
  - Belege: `app/(app)/transactions/page.tsx:50`
  - Buchungen: `app/(app)/transactions/page.tsx:64`
- Rechnungen-Seite:
  - Kundenliste: `app/(app)/invoices/page.tsx:29`
  - Rechnungsliste: `app/(app)/invoices/page.tsx:42`
- Kunden-Seite:
  - Kundenliste: `app/(app)/customers/page.tsx:46`
- Belege-Seite:
  - Belegliste: `app/(app)/receipts/page.tsx:20`
- Einstellungen:
  - Firmenprofil lesen: `app/(app)/settings/page.tsx:11`
  - Firmenprofil updaten: `app/(app)/settings/actions.ts:52`, `app/(app)/settings/actions.ts:57`
- Exporte/PDF:
  - Vollbackup exportiert `companyProfile` global: `app/(app)/export/route.ts:48`
  - Rechnungs-PDF liest `companyProfile` global: `app/(app)/invoices/[id]/pdf/route.ts:45`
  - EÜR-PDF liest `companyProfile` global: `app/(app)/reports/pdf/route.ts:46`

In einer echten Solo-Installation mit genau einem Nutzer kann das praktisch unauffaellig bleiben. Technisch ist es trotzdem ein Sicherheits- und Datenschutzrisiko, weil schon ein zweiter Supabase-User oder Testdaten im selben Projekt Daten vermischen koennen.

### Rollen und Rechte

- Es gibt keine Rollen- oder Rechteverwaltung.
- Fuer EDGECO als Ein-Inhaber-App ist das wahrscheinlich bewusst und angemessen.
- Falls spaeter Steuerberater-Zugang, Leserechte oder Admin/User-Trennung geplant sind, fehlt dafuer die Grundlage.

### Storage-RLS

Der Bucket `belege` ist privat, aber die Storage Policies sind zu breit:

- Insert: `db/setup-storage.ts:18` bis `db/setup-storage.ts:20`
- Select: `db/setup-storage.ts:23` bis `db/setup-storage.ts:25`
- Delete: `db/setup-storage.ts:28` bis `db/setup-storage.ts:30`

Alle authentifizierten Nutzer duerfen den gesamten Bucket lesen/loeschen, solange `bucket_id = 'belege'`. Das sollte auf Pfadpraefix `auth.uid()` begrenzt werden, weil Uploads bereits unter `${user.id}/...` gespeichert werden (`components/ReceiptUpload.tsx`).

### ENV und Secrets

Positiv:

- `.gitignore` ignoriert `.env*` und erlaubt nur `.env.example`.
- `.env.example` enthaelt nur Platzhalter fuer Supabase, Resend, Shopify und Cron.
- Resend- und Shopify-Secrets werden serverseitig gelesen:
  - Resend: `app/(app)/invoices/actions.ts:300`, `app/(app)/invoices/actions.ts:307`
  - Shopify/Cron: `app/api/shopify/sync/route.ts:7`, `app/api/shopify/sync/route.ts:23`, `app/api/shopify/sync/route.ts:33`, `app/api/shopify/sync/route.ts:34`

Zu beachten:

- `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` sind im Client korrekt oeffentlich.
- `DATABASE_URL` ist serverseitig privilegiert und umgeht RLS. Deshalb sind Owner-Filter Pflicht.

### CSRF, XSS, Injection

- React escaped UI-Ausgaben standardmaessig; es wurde kein `dangerouslySetInnerHTML` gefunden.
- Drizzle erzeugt parametrisierte SQL-Queries; keine dynamische User-SQL-Erzeugung in App-Pfaden sichtbar.
- `sql.unsafe` kommt nur in Setup-Skripten mit statischem SQL vor (`db/setup-storage.ts`, `db/secure-rls.ts`).
- CSV-Export quoted Felder (`app/(app)/reports/export/route.ts:128`), schuetzt aber nicht gegen CSV/Excel-Formula-Injection bei Werten, die mit `=`, `+`, `-` oder `@` beginnen.
- State-changing Server Actions haben keinen eigenen CSRF-Token. Fuer eine normale Next/Supabase-App ist das oft akzeptabel, sollte aber bei extern erreichbarer Produktiv-App mit Origin-/SameSite-Verhalten und Next-Server-Action-Schutz bewusst geprueft werden.

## Buchhaltungsfunktionen

### Kundenverwaltung

Vorhanden:

- Kunden anlegen, bearbeiten, loeschen.
- Zod-Validierung fuer Name, Adresse, E-Mail.
- Kunden koennen fuer Rechnungen genutzt werden.

Luecken/Risiken:

- Kundenliste ohne `ownerId`-Filter (`app/(app)/customers/page.tsx:46`).
- Loeschen ist hartes DB-Delete (`app/(app)/customers/actions.ts:105`), wird aber durch FK blockiert, falls Rechnungen existieren.
- Keine History bei Adressaenderungen. Fuer gesendete Rechnungen ist relevant, welche Kundenadresse zum Versandzeitpunkt galt.

### Rechnungen

Vorhanden:

- Rechnungserstellung mit Positionen.
- Fortlaufende Nummer per `RE-<Jahr>-<Sequenz>`.
- Status: `draft`, `sent`, `paid`, `cancelled`.
- PDF-Route.
- E-Mail-Versand per Resend.
- Status `paid` legt automatisch eine Einnahme an.

Risiken:

- Rechnungserstellung nutzt DB-Transaktion fuer Invoice, Items und `nextInvoiceNo` (`app/(app)/invoices/actions.ts:90` bis `app/(app)/invoices/actions.ts:121`), aber ohne Unique-Constraint und ohne sichere Row-Lock-Strategie.
- `companyProfile` wird global gelesen (`app/(app)/invoices/actions.ts:91`).
- `createInvoice()` prueft nicht, ob das Rechnungsjahr gesperrt ist, obwohl `isYearLocked` importiert ist.
- `createInvoice()` validiert nicht serverseitig, ob `customerId` dem `ownerId` gehoert.
- Rechnungen koennen hart geloescht werden (`app/(app)/invoices/actions.ts:145`); verknuepfte Einnahmen werden nur entkoppelt (`app/(app)/invoices/actions.ts:139` bis `app/(app)/invoices/actions.ts:141`).
- `setInvoiceStatus()` erlaubt serverseitig `draft`, `sent`, `paid` ohne saubere Statusmaschine (`app/(app)/invoices/actions.ts:160`, `app/(app)/invoices/actions.ts:222`).
- Beim Setzen auf `paid` werden Einnahme-Insert und Status-Update nicht in einer gemeinsamen DB-Transaktion ausgefuehrt (`app/(app)/invoices/actions.ts:207`, `app/(app)/invoices/actions.ts:221`).
- Es gibt keine Storno-/Gutschrift-Aktion, obwohl `cancelled` im Enum vorbereitet ist.
- Keine Speicherung der final versendeten PDF-Datei, obwohl `pdfPath` im Schema existiert.

### Rechnungsnummern

Vorhanden:

- `formatInvoiceNumber()` formatiert `RE-JJJJ-NNNN`.
- `company_profile.nextInvoiceNo` wird bei Erstellung hochgezaehlt.

Risiken:

- Kein Unique-Constraint auf `invoices.number`.
- Kein Schutz gegen parallele Rechnungen mit gleicher Nummer.
- `nextInvoiceNo` ist im UI manuell aenderbar (`components/SettingsForm.tsx:67` bis `components/SettingsForm.tsx:72`).
- Hartes Loeschen erzeugt Luecken.
- Kein Audit, wer/wann Nummern geaendert hat.

### PDF-Erstellung

Vorhanden:

- Rechnungs-PDF mit Firmenadresse, Kunde, Rechnungsnummer, Datum, Positionen, Gesamtbetrag, §19-Hinweis, optional Steuernummer/IBAN:
  - Titel: `lib/pdf/invoice-pdf.ts:181`
  - Rechnungsnummer: `lib/pdf/invoice-pdf.ts:198`
  - Datum: `lib/pdf/invoice-pdf.ts:200`
  - Gesamtbetrag: `lib/pdf/invoice-pdf.ts:269`
  - §19-Hinweis: `lib/pdf/invoice-pdf.ts:275`
  - Steuernummer/IBAN: `lib/pdf/invoice-pdf.ts:297` bis `lib/pdf/invoice-pdf.ts:299`
- EÜR-PDF existiert.
- PDF-Layout hat Tests.

Luecken:

- Rechnungspdf wird bei Abruf live neu generiert (`app/(app)/invoices/[id]/pdf/route.ts:60`).
- `companyProfile` wird global fuer PDF gelesen (`app/(app)/invoices/[id]/pdf/route.ts:45`).
- Keine gespeicherte, unveraenderliche Versandversion.
- Kein `sentAt`, `sentTo`, `mailProviderMessageId`, `pdfHash`.
- Leistungsdatum/Lieferdatum und Zahlungsziel fehlen als strukturierte Rechnungsfelder.

### E-Mail-Versand

Vorhanden:

- Resend API wird serverseitig genutzt.
- Fehlende ENV-Werte erzeugen klare Fehler (`lib/mail/send.ts:22` bis `lib/mail/send.ts:29`).
- PDF wird als Base64-Anhang gesendet (`lib/mail/send.ts:43`).
- Fehlerhafte Resend-Antworten werden mit Status/Text weitergegeben (`lib/mail/send.ts:52` bis `lib/mail/send.ts:55`).
- Nach erfolgreichem Versand wird Status auf `sent` gesetzt, sofern nicht `paid` (`app/(app)/invoices/actions.ts:324` bis `app/(app)/invoices/actions.ts:328`).

Luecken:

- Kein Mail-Log.
- Keine Speicherung der gesendeten PDF.
- Keine Provider-Message-ID.
- Keine Wiederhol-/Retry-Strategie.
- Keine technische Sperre gegen erneutes Senden mit veraenderten Stammdaten.

### Einnahmen und Ausgaben

Vorhanden:

- Buchungen anlegen, bearbeiten, loeschen.
- Betrag in Cent.
- Kategorien und Beleg-Verknuepfung.
- Jahreslock wird in `createTransaction`, `updateTransaction`, `deleteTransaction` geprueft:
  - Create: `app/(app)/transactions/actions.ts:71`
  - Update: `app/(app)/transactions/actions.ts:122` bis `app/(app)/transactions/actions.ts:123`
  - Delete: `app/(app)/transactions/actions.ts:161`

Risiken:

- Buchungsliste liest ohne `ownerId`-Filter (`app/(app)/transactions/page.tsx:64`).
- `deleteTransaction()` loescht hart (`app/(app)/transactions/actions.ts:166`), obwohl Schema und Kommentare `status = 'cancelled'` als GoBD-Weg vorbereiten.
- Keine Audit-History fuer Aenderungen.
- Keine Transaktionssicherheit fuer komplexere Mutationen mit mehreren Tabellen, ausser bei Rechnungserstellung.

### Belegverwaltung

Vorhanden:

- Upload in privaten Supabase-Storage-Bucket.
- SHA-256-Hash im Browser.
- DB-Metadaten mit `fileHash`.
- Signierte URLs fuer Anzeige.
- OCR-Button fuer Bildbelege.

Risiken:

- Belegliste liest alle Belege ohne `ownerId`-Filter (`app/(app)/receipts/page.tsx:20`).
- Storage-Policies sind bucketweit fuer alle authentifizierten Nutzer offen.
- `deleteReceipt()` entkoppelt Buchungen, loescht Storage-Datei und loescht DB-Zeile (`app/(app)/receipts/actions.ts:41`, `app/(app)/receipts/actions.ts:51`, `app/(app)/receipts/actions.ts:55`).
- `deleteReceipt()` prueft nicht, ob verknuepfte Buchungen in einem gesperrten Jahr liegen.
- Belege sind im JSON-Backup nur als Metadaten enthalten, nicht als Dateiarchiv.

### Anlagen und AfA

Vorhanden:

- Anlagen CRUD.
- Lineare monatsgenaue AfA.
- AfA in Dashboard und Reports.
- Tests fuer AfA.

Risiken:

- Anlage kann hart geloescht werden (`app/(app)/assets/actions.ts:124`).
- Verknuepfte Buchungen werden entkoppelt (`app/(app)/assets/actions.ts:119` bis `app/(app)/assets/actions.ts:121`).
- Kein Jahreslock in `createAsset`, `updateAsset`, `deleteAsset`.
- Keine Dokumentation/Validierung, ob Anlage als direkte Ausgabe oder nur ueber AfA in EÜR wirkt.

### Auswertungen, EÜR und Exporte

Vorhanden:

- Dashboard mit Einnahmen, Ausgaben, AfA, Gewinn, offenen Rechnungen.
- EÜR-Seite mit Jahresfilter, Monatsuebersicht, Kategorieaufschluesselung, AfA.
- EÜR-CSV-Export.
- EÜR-PDF-Export.
- Vollbackup als JSON.

Luecken:

- EÜR-PDF ist eine freie Auswertung, keine amtliche Anlage-EÜR-Zeilenlogik.
- CSV-Export ist vorhanden, aber kein Excel-XLSX-Export.
- Kein DATEV-Export.
- Kein Export-Log mit Hash, Zeitraum, Nutzer, Dateiname.
- JSON-Backup hat keine Restore-Funktion.
- Beleg-Dateien werden nicht mit exportiert.
- `companyProfile` im Vollbackup wird global gelesen (`app/(app)/export/route.ts:48`).

### Mahnwesen, Storno, Gutschriften

Nicht vorhanden:

- Mahnstufen/Mahnstatus.
- Zahlungserinnerungen.
- Stornorechnungen.
- Gutschriften.
- Korrekturrechnungen.

Das ist fuer den aktuellen Solo-Scope nicht zwingend als erstes Feature noetig, aber Storno/Gutschrift ist wichtiger als Mahnwesen, weil es direkt mit unveraenderlichen Rechnungen und Loeschverbot zusammenhaengt.

### Umsatzsteuer

Vorhanden:

- §19-Kleinunternehmerhinweis in PDF und Profil.
- Keine Umsatzsteuerberechnung, passend zur Projektvorgabe.

Bewertung:

- Eine Umsatzsteuer-Voranmeldung oder USt-Auswertung ist fuer EDGECO wahrscheinlich unnoetig, solange §19 UStG gilt.
- Es sollte aber technisch klar dokumentiert bleiben, dass Preise als Endpreise ohne USt-Ausweis behandelt werden.

## Shopify-Integration

### Vorhanden

- Manueller CSV/JSON-Import in `app/(app)/shopify/actions.ts`.
- Parser fuer Shopify CSV/API-JSON in `lib/import/shopify.ts`.
- DB-Import als Einnahme in `lib/import/shopify-booking.ts`.
- Admin-API-Fetch in `lib/import/shopify-api.ts`.
- Cron-Route in `app/api/shopify/sync/route.ts`.
- Vercel Cron in `vercel.json`.
- Schutz der Cron-Route mit `Authorization: Bearer <CRON_SECRET>` (`app/api/shopify/sync/route.ts:7`, `app/api/shopify/sync/route.ts:15`).
- API-Keys kommen aus ENV (`app/api/shopify/sync/route.ts:33`, `app/api/shopify/sync/route.ts:34`).
- Idempotenz ueber Marker `[shopify:<id>]`:
  - bestehende IDs: `lib/import/shopify-booking.ts:16` bis `lib/import/shopify-booking.ts:24`
  - Insert: `lib/import/shopify-booking.ts:43`
  - Marker im Text: `lib/import/shopify-booking.ts:79`

### Luecken und Risiken

- Keine DB-Unique-Sicherung fuer Shopify-ID. Parallel laufende Imports koennen doppelt buchen.
- Kein Importlauf-Log.
- Kein Jahreslock im Shopify-Import.
- Kein Transaktionswrapper fuer "bestehende IDs lesen + neue buchen".
- Deduplizierung ueber Beschreibungstext ist fragil.
- API-Fetch nutzt `financial_status=paid` und `limit=50` (`lib/import/shopify-api.ts:23` bis `lib/import/shopify-api.ts:26`), aber keine Pagination.
- Parser importiert `current_total_price`/`total_price` (`lib/import/shopify.ts:147` bis `lib/import/shopify.ts:150`), aber keine separaten Felder fuer:
  - Shopify-Gebuehren
  - Zahlungsanbieter-Gebuehren
  - Versandkosten
  - Steuern
  - Refunds/Teilrefunds
  - Netto/Brutto-Abgleich
- Keine automatische Rechnungserstellung aus Shopify-Bestellungen.

Bewertung: Als Einnahmenimport fuer eine kleine §19-App ist die Richtung richtig. Fuer belastbare Buchhaltung sollte die Idempotenz in die DB und die Importlaeufe sollten protokolliert werden.

## Rechtliche und GoBD-nahe Anforderungen

### Bereits vorhanden

- Jahres-Festschreibung in `fiscal_locks`.
- Lock-UI in Reports.
- Lock-Pruefung fuer manuelle Buchungen und "Rechnung bezahlt".
- `booking_status.cancelled` und `invoice_status.cancelled` sind vorbereitet.
- Belege speichern Hash.
- Exporte enthalten `exportedAt`.

### Nicht ausreichend umgesetzt

- Rechnungen werden nach Versand nicht technisch unveraenderbar.
- PDF-Versandversion wird nicht gespeichert.
- Wichtige Buchhaltungsdaten koennen geloescht werden:
  - Buchungen: `app/(app)/transactions/actions.ts:166`
  - Rechnungen: `app/(app)/invoices/actions.ts:145`
  - Belege: `app/(app)/receipts/actions.ts:55`
  - Anlagen: `app/(app)/assets/actions.ts:124`
- Jahres-Festschreibung kann jederzeit geloescht werden (`app/(app)/reports/lock-actions.ts:39`, `app/(app)/reports/lock-actions.ts:47`).
- Es gibt kein Audit-Log fuer Create/Update/Delete/Statuswechsel/Export/Versand.
- Es gibt keine Storno- oder Gutschriftenlogik.
- Rechnungsnummern sind nicht lueckenlos erzwingbar.
- Belegarchivierung umfasst keine unveraenderbare Dateiablage mit Retention-Regeln.
- Exporte sind nicht nachvollziehbar historisiert.

Empfehlung: Nicht mit einem grossen "GoBD-Modul" starten. Zuerst technische Unveraenderlichkeit fuer Rechnungen/Belege/Buchungen einziehen: Soft-Cancel statt Delete, Audit-Log, gespeicherte PDF-Version, Unique-Constraints.

## Tests und Qualitaet

### Vorhandene Tests

- `lib/money.test.ts`
- `lib/calc/eur.test.ts`
- `lib/calc/invoice.test.ts`
- `lib/calc/afa.test.ts`
- `lib/pdf/invoice-pdf.test.ts`
- `lib/pdf/eur-pdf.test.ts`
- `lib/mail/send.test.ts`
- `lib/ocr/parse-receipt.test.ts`
- `lib/import/shopify-api.test.ts`
- `lib/import/shopify.test.ts`

Bewertung: Die reinen Kernmodule sind gut abgedeckt. Kritische App-Flows sind noch nicht abgedeckt.

### Fehlende Tests

Hohe Prioritaet:

- Owner-Scoping in allen Server Components und Route Handlern.
- Rechnungsnummernvergabe: keine Duplikate, kein Zuruecksetzen unter letzte Nummer.
- Rechnungsversand: PDF wird gespeichert, Status/Log wird geschrieben, Fehlerfall laesst Status unveraendert.
- Statusuebergaenge von Rechnungen: keine Rueckkehr von `paid` nach `draft/sent`, Storno nur ueber Korrekturprozess.
- Jahreslock fuer alle relevanten Mutationen, inklusive Shopify, Belege, Anlagen, Rechnungen.
- Loeschpfade: statt Delete wird storniert/gesperrt.
- Shopify-Import: doppelte Imports, parallele Imports, Pagination, Fehlerfalle.
- Export: CSV escaping plus Formel-Injection-Schutz, JSON-Backup nur eigene Daten.

Mittlere Prioritaet:

- Route-Handler-Tests fuer `/export`, `/reports/export`, `/reports/pdf`, `/invoices/[id]/pdf`, `/api/shopify/sync`.
- Tests fuer PDF-Pflichtangaben und gespeicherte Versandversion.
- Tests fuer Storage-Pfadvalidierung bei Belegen.

### Quality-Gates

Aktueller Stand:

- `npm run lint`: bestanden
- `node node_modules/typescript/bin/tsc --noEmit`: bestanden
- `npm test`: bestanden, 45 Tests
- `npm run build`: ohne `DATABASE_URL` fehlgeschlagen; mit Dummy-`DATABASE_URL` bestanden

TypeScript:

- `strict: true` ist aktiv.
- `allowJs: true` ist aktiv, obwohl keine JS-App-Dateien sichtbar sind; fuer striktere TS-Qualitaet koennte das spaeter auf `false`.
- `skipLibCheck: true` ist fuer Next/React-Projekte ueblich, aber kein maximal striktes Setup.

Lint/Formatting:

- ESLint ist konfiguriert.
- Kein explizites Prettier/Format-Script sichtbar.

## Risiken nach Schweregrad

### Hoch

1. Fehlende `ownerId`-Filter in mehreren Datenlisten und Profilzugriffen  
   Risiko: Datenvermischung/Datenschutzproblem bei zweitem Nutzer oder Testdaten.  
   Beispiele: `app/(app)/transactions/page.tsx:64`, `app/(app)/invoices/page.tsx:42`, `app/(app)/receipts/page.tsx:20`, `app/(app)/settings/page.tsx:11`.

2. Harte Loeschungen buchhaltungsrelevanter Daten  
   Risiko: nicht nachvollziehbare Buchhaltung, Luecken in Rechnungen/Belegen/Buchungen.  
   Beispiele: `app/(app)/transactions/actions.ts:166`, `app/(app)/invoices/actions.ts:145`, `app/(app)/receipts/actions.ts:55`, `app/(app)/assets/actions.ts:124`.

3. Gesendete Rechnungen sind nicht unveraenderlich  
   Risiko: Versandstand nicht rekonstruierbar, geaenderte Stammdaten erzeugen spaeter anderes PDF.  
   Beispiele: Live-PDF `app/(app)/invoices/[id]/pdf/route.ts:60`, ungenutztes `pdfPath` `db/schema.ts:103`, Status-Update nach Mail `app/(app)/invoices/actions.ts:327`.

4. Rechnungsnummern nicht DB-seitig abgesichert  
   Risiko: doppelte Nummern, Luecken, manuelle Ruecksetzung.  
   Beispiele: `db/schema.ts:97`, `app/(app)/invoices/actions.ts:91`, `app/(app)/invoices/actions.ts:119`, `components/SettingsForm.tsx:67`.

5. Storage-RLS fuer Belege zu breit  
   Risiko: jeder authentifizierte Nutzer kann gesamte Belegdateien lesen/loeschen.  
   Beispiele: `db/setup-storage.ts:23` bis `db/setup-storage.ts:30`.

### Mittel

1. Shopify-Import ohne DB-Unique, Pagination, Importlog und Jahreslock.  
   Beispiele: `lib/import/shopify-booking.ts:33`, `lib/import/shopify-booking.ts:43`, `lib/import/shopify-api.ts:25`, `lib/import/shopify-api.ts:26`.

2. Keine Audit-History fuer Aenderungen, Statuswechsel, Versand und Exporte.

3. Firmenprofil global statt pro `ownerId`.  
   Beispiele: `app/(app)/settings/actions.ts:52`, `app/(app)/export/route.ts:48`, `app/(app)/reports/pdf/route.ts:46`.

4. Statusmaschine fuer Rechnungen zu schwach.  
   Beispiel: `app/(app)/invoices/actions.ts:160`, `app/(app)/invoices/actions.ts:222`.

5. CSV/Excel-Formula-Injection nicht neutralisiert.  
   Beispiel: `app/(app)/reports/export/route.ts:128`.

6. Exporte nicht historisiert und Belegdateien nicht im Backup enthalten.

### Niedrig

1. Duplizierte Auth-Helfer in Actions.
2. Keine zentrale Business-Service-Schicht fuer kritische Regeln.
3. README ist noch weitgehend Create-Next-App-Standard.
4. Kein explizites Format-Script.

## Priorisierte Feature-Liste

### Muss unbedingt noch rein

1. `ownerId`-Filter in allen Datenlesepfaden und Profilzugriffen nachziehen.
2. Storage-RLS fuer `belege` auf Nutzerpfad begrenzen.
3. Harte Deletes fuer Buchungen, Rechnungen, Belege und Anlagen durch Storno/Archiv-/Inaktiv-Status ersetzen.
4. Audit-Log fuer Create/Update/Delete/Cancel/Statuswechsel/Mailversand/Export einfuehren.
5. Rechnungen nach Versand einfrieren:
   - finale PDF in Storage speichern
   - `pdfPath`, `pdfHash`, `sentAt`, `sentTo`, `sentBy`, Provider-ID speichern
   - PDF danach aus gespeicherter Datei ausliefern
6. Rechnungsnummern DB-seitig absichern:
   - Unique-Constraint auf `(owner_id, number)` oder global `number`
   - sichere Sequenzvergabe mit Row-Lock/atomarem Update
   - manuelle Ruecksetzung verhindern oder auditieren
7. Jahreslock auf alle relevanten Mutationen ausweiten:
   - Rechnungen erstellen/loeschen/statusaendern
   - Belege entkoppeln/loeschen
   - Anlagen aendern/loeschen
   - Shopify-Import
8. Server-Action- und Route-Handler-Tests fuer Owner-Scoping, Locks, Loeschverhalten und Rechnungsversand.

### Sollte zeitnah rein

1. Stornorechnung/Gutschrift als eigener Flow statt `deleteInvoice`.
2. Shopify-Importlog mit externer Order-ID, Lauf-ID, Status, Fehlern und Hash/Quelle.
3. DB-Unique fuer Shopify-Order-IDs, nicht nur Textmarker in `transactions.description`.
4. Shopify-Pagination und bessere Behandlung von Refunds/Gebuehren/Versandkosten.
5. Export-Log mit Zeitraum, Dateiart, Hash, Nutzer, Erstellzeitpunkt.
6. JSON-Restore oder zumindest dokumentierter Restore-Prozess.
7. Belegdateien in Backup/Export einbeziehen oder separaten Storage-Archivexport bauen.
8. CSV-Export gegen Excel-Formula-Injection haerten.
9. Indizes fuer `owner_id`, Datum und Foreign Keys.
10. Statusfelder erweitern:
    - `paidAt`
    - `sentAt`
    - `cancelledAt`
    - `cancelReason`
    - `paymentDate` getrennt von Rechnungsdatum.

### Nice-to-have

1. Amtliche Anlage-EÜR-Zeilenlogik statt freier EÜR-PDF.
2. XLSX-Export zusaetzlich zu CSV.
3. DATEV-Export, wenn der Steuerberater ihn wirklich nutzt.
4. Mahnwesen mit Zahlungserinnerung und Mahnstufen.
5. Wiederkehrende Buchungen.
6. Dashboard-KPI fuer unverbuchte Belege.
7. Mehrjahresvergleich.
8. OCR-Verbesserungen und Beleg-Vorschlaege fuer Kategorie/Zahlungsart.

### Fuer EDGECO wahrscheinlich unnoetig

1. Mehrmandanten-/Team-/Enterprise-Rollen, solange genau ein Inhaber arbeitet.
2. Komplexe Freigabe-Workflows mit Vier-Augen-Prinzip.
3. Umsatzsteuer-Voranmeldung, solange §19 UStG gilt und keine USt ausgewiesen wird.
4. Vollstaendige Warenwirtschaft/Lagerverwaltung, falls Shopify das fuehrende System bleibt.
5. Komplexe Debitorenbuchhaltung mit Teilzahlungen, Skonto und Inkasso, solange Rechnungsvolumen klein bleibt.
6. Mandantenfaehige Steuerberater-Portale; ein sauberer Export reicht vermutlich.

## Empfohlene naechste Schritte

1. Sicherheits- und Datenintegritaetsfixes zuerst:
   - alle fehlenden `ownerId`-Filter nachziehen
   - Storage-Policies einschraenken
   - Firmenprofil pro `ownerId` lesen/schreiben

2. Rechnungs- und GoBD-Kern stabilisieren:
   - Rechnungsnummern unique und atomar vergeben
   - Delete-Flows durch Storno/Archiv ersetzen
   - gesendete PDFs speichern und hashen
   - Audit-Log einfuehren

3. Lock-Regeln vereinheitlichen:
   - zentraler Helper fuer "Mutation betrifft Jahr X"
   - Anwendung auf Rechnungen, Belege, Anlagen, Shopify
   - Unlock nur mit Audit-Eintrag und Begruendung

4. Tests um kritische Flows erweitern:
   - Owner-Scoping
   - Invoice-Sequenz
   - Mailversand/PDF-Speicherung
   - Jahreslocks
   - Shopify-Idempotenz
   - Route Handler

5. Danach Fachfeatures:
   - Gutschrift/Storno
   - Shopify-Importlog und Gebuehren/Refunds
   - DATEV/XLSX nur bei echtem Bedarf

