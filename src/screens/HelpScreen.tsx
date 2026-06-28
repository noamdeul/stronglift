interface Props {
  onBack: () => void;
}

export function HelpScreen({ onBack }: Props) {
  return (
    <>
      <div className="screen-header">
        <button className="muted" onClick={onBack} style={{ marginBottom: 8 }}>
          ‹ Back to settings
        </button>
        <h1>Help</h1>
        <div className="sub">How FiveByFive works</div>
      </div>
      <div className="screen">
        <div className="section-label">The basics</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            FiveByFive is a 5×5 strength program: each workout is a handful of
            barbell lifts done for 5 sets of 5 reps (deadlift is a single set of
            5). Open the <strong>Today</strong> tab, tap each set as you finish it
            to log your reps, then tap once more to mark a missed rep. Everything
            saves automatically — there's no “done” button to forget.
          </p>
        </div>

        <div className="section-label">A / B workouts</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            Workouts alternate between two days so every muscle group gets hit
            twice a week:
          </p>
          <ul className="help-list">
            <li>
              <strong>Workout A</strong> — Squat · Bench Press · Barbell Row
            </li>
            <li>
              <strong>Workout B</strong> — Squat · Overhead Press · Deadlift
            </li>
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>
            After you finish a session the app flips to the other workout for next
            time. Squat is in both, so you squat every session.
          </p>
        </div>

        <div className="section-label">Warmup sets</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            Each lift gets warmup sets generated automatically — starting with the
            empty bar and ramping up toward your working weight. They help you
            groove the movement and don't count toward your progression, so skip
            or adjust them as you like.
          </p>
        </div>

        <div className="section-label">Progression &amp; deload</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            This is the engine that drives the program:
          </p>
          <ul className="help-list">
            <li>
              <strong>Succeed</strong> — hit every work set at the target reps and
              the weight goes up next time by that lift's increment (usually
              +2.5&nbsp;kg / 5&nbsp;lb, +5&nbsp;kg / 10&nbsp;lb for deadlift).
            </li>
            <li>
              <strong>Miss</strong> — fall short on a lift and the weight stays the
              same next time so you can try again.
            </li>
            <li>
              <strong>Deload</strong> — miss the same lift 3 sessions in a row and
              the weight drops ~10% to build back up with momentum.
            </li>
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>
            The failure count and deload amount are both adjustable under
            <strong> Deload</strong> in Settings.
          </p>
        </div>

        <div className="section-label">Rest timer</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            A countdown starts after each work set so you rest long enough to lift
            heavy. In Settings you can set the rest length for work sets and
            deadlifts separately, turn the finish sound on or off, and keep the
            screen awake during a workout.
          </p>
        </div>

        <div className="section-label">Units, bar &amp; plates</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            Switch between <strong>kg</strong> and <strong>lb</strong> any time —
            all your weights convert and round to the nearest loadable plate. Tell
            the app your bar weight and which plates you own and it shows exactly
            what to load on each side of the bar.
          </p>
        </div>

        <div className="section-label">Workout days</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            Pick the days you plan to train and the Today screen previews your
            upcoming sessions. This is just for planning — it never changes your
            progression.
          </p>
        </div>

        <div className="section-label">History &amp; Progress</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            The <strong>History</strong> tab lists every completed workout — tap one
            to see each set, your estimated 1RM, and any 🏆 PR badges. The
            <strong> Progress</strong> tab charts your working weight over time for
            each lift so you can watch the numbers climb.
          </p>
        </div>

        <div className="section-label">Backup &amp; your data</div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            All of your data lives only in this browser on this device — there's no
            account and nothing is sent anywhere. Export a backup file regularly
            (and to move to another device), and import it to restore. Reset wipes
            everything, so back up first. Find all of this under
            <strong> Backup</strong> in Settings.
          </p>
        </div>
      </div>
    </>
  );
}
