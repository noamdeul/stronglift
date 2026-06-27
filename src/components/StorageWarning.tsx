import { useBackupExport } from '../hooks/useBackupExport';
import { useAppStore } from '../store/useAppStore';

/**
 * Danger banner shown when a persist write failed because localStorage is full.
 * The latest changes are still in memory but were not saved, so we urge an
 * immediate export before the data can be lost on reload.
 */
export function StorageWarning() {
  const persistError = useAppStore((s) => s.persistError);
  const dismiss = useAppStore((s) => s.dismissPersistError);
  const exportBackup = useBackupExport();

  if (!persistError) return null;

  return (
    <div className="storage-warning">
      <span>Storage full — recent changes weren't saved. Export a backup now.</span>
      <button onClick={exportBackup}>Export backup</button>
      <button aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
