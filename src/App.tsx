import { useState } from 'react';
import { BackupReminder } from './components/BackupReminder';
import { BottomNav } from './components/BottomNav';
import { RestTimerBar } from './components/RestTimerBar';
import { StorageWarning } from './components/StorageWarning';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { useWakeLock } from './hooks/useWakeLock';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useAppStore } from './store/useAppStore';
import type { Tab } from './store/useAppStore';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const { needRefresh, update, dismiss } = usePwaUpdate();
  const keepScreenAwake = useAppStore((s) => s.settings.keepScreenAwake);
  const workoutActive = useAppStore((s) => s.currentSession != null);
  useWakeLock(keepScreenAwake && workoutActive);

  return (
    <div className="app">
      {tab === 'today' && <TodayScreen />}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'settings' && <SettingsScreen />}

      <RestTimerBar />

      <BackupReminder />

      <StorageWarning />

      {needRefresh && (
        <div className="update-toast">
          <span>New version available</span>
          <button onClick={update}>Reload</button>
          <button onClick={dismiss}>✕</button>
        </div>
      )}

      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
