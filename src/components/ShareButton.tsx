import { useState } from 'react';
import { buildShareModel } from '../domain/share';
import type { WorkoutSession } from '../domain/types';
import { renderShareImage } from '../lib/shareImage';
import { useAppStore } from '../store/useAppStore';

interface Props {
  session: WorkoutSession;
  /** Override the button class (defaults to a neutral `btn`). */
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

export function ShareButton({ session, className, label = '📤 Share' }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const customExercises = useAppStore((s) => s.customExercises);

  const onShare = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const model = buildShareModel(session, customExercises);
      const blob = await renderShareImage(model);
      const file = new File([blob], model.fileName, { type: 'image/png' });

      // Prefer the native share sheet when it can handle files (mobile).
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: model.title,
          text: `${model.title} — ${model.summaryText}`,
        });
      } else {
        downloadBlob(blob, model.fileName);
        setMsg('Image saved to your downloads.');
      }
    } catch (e) {
      // The user dismissing the native share sheet is not an error.
      if ((e as Error).name === 'AbortError') return;
      setMsg(`Couldn't create image: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={className ?? 'btn'} onClick={onShare} disabled={busy}>
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
