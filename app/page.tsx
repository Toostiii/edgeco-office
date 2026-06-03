import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Einnahmen & Ausgaben",
    text: "Jede Buchung erfassen — die EÜR rechnet automatisch.",
  },
  {
    title: "Belege per Handy",
    text: "Quittung unterwegs abfotografieren, GoBD-konform abgelegt.",
  },
  {
    title: "Rechnungen schreiben",
    text: "Custom-Parts abrechnen, PDF mit §19-Hinweis, fortlaufende Nummer.",
  },
  {
    title: "AfA & Auswertungen",
    text: "Abschreibungen automatisch, EÜR-Export für den Steuerberater.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="EDGECO Office"
          width={260}
          height={170}
          priority
          className="mb-8 h-auto w-[220px]"
        />

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="brand-gradient-text">EDGECO Office</span>
        </h1>
        <p className="mt-3 text-lg text-muted">Buchhaltung. Einfach. Digital.</p>
        <p className="mt-4 max-w-xl text-muted">
          Deine eigene EÜR-Buchhaltung für EDGECO — Einnahmen, Ausgaben, Belege,
          Rechnungen und AfA an einem Ort. Von Laptop und Handy, überall.
        </p>

        <Link
          href="/login"
          className="brand-gradient mt-8 rounded-lg px-7 py-3 font-semibold text-white shadow-md transition hover:opacity-90"
        >
          Anmelden
        </Link>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="font-semibold text-brand">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>

        <p className="mt-16 text-xs text-muted">
          Kleinunternehmer §19 UStG · EÜR · GoBD-konform
        </p>
      </div>
    </main>
  );
}
