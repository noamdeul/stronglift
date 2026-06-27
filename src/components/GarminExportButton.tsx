import { useState } from 'react';
import type { WorkoutSession } from '../domain/types';
import { buildFitBlob, fitFileName } from '../lib/fitExport';
import { useAppStore } from '../store/useAppStore';

interface Props {
  session: WorkoutSession;
  className?: string;
  label?: string;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports the given session as a Garmin-compatible strength `.FIT` file. Garmin
 * Connect has no open write API, so the flow is: download the file, then
 * manually import it in Connect (web → Import Data).
 */
export function GarminExportButton({ session, className, label = '⌚ Export to Garmin (.FIT)' }: Props) {
  const settings = useAppStore((s) => s.settings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onExport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await buildFitBlob(session, settings);
      downloadBlob(blob, fitFileName(session));
      setMsg('Saved. Import it in Garmin Connect → Import Data.');
    } catch (e) {
      setMsg(`Couldn't create file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={className ?? 'btn'} onClick={onExport} disabled={busy}>
        {busy ? 'Preparing…' : label}
      </button>
      {msg && (
        <p className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
          {msg}
        </p>
      )}
    </>
  );
}
