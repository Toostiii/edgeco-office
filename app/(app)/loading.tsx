/**
 * Sofortige Ladeanzeige bei Navigation im App-Bereich (perceived performance).
 */
export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
        <p className="text-sm text-muted">Lädt …</p>
      </div>
    </div>
  );
}
