import { useRef, useState } from 'react';
import type { AppState } from '../domain/types';
import { useAppStore } from '../store/useAppStore';

export function DataIO() {
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `fivebyfive-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      if (!parsed || !parsed.exerciseStates || !Array.isArray(parsed.history)) {
        throw new Error('Not a valid backup file');
      }
      importData(parsed as AppState);
      setMsg('Backup imported.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="btn-row">
        <button className="btn" onClick={onExport}>
          ⬇️ Export
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆️ Import
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = '';
        }}
      />
      {msg && (
        <p className="muted" style={{ marginTop: 10 }}>
          {msg}
        </p>
      )}
    </div>
  );
}
