import { buildFitMessages, type FitMessage } from '../domain/garmin';
import { sessionSlug } from '../domain/session';
import type { Settings, WorkoutSession } from '../domain/types';

/**
 * Encodes a completed session as a Garmin-compatible strength-training `.FIT`
 * file. This is the browser/library counterpart to the pure `buildFitMessages`
 * in `domain/garmin.ts` — it touches the `@garmin/fitsdk` Encoder and resolves
 * profile enum values, so it lives outside `domain/`.
 *
 * The SDK is imported lazily so it stays out of the main bundle (and the PWA
 * precache); it is only pulled in when the user actually exports.
 */

function applyMessage(encoder: any, MesgNum: any, msg: FitMessage, subtypeFor: (m: Extract<FitMessage, { kind: 'set' }>) => number | undefined): void {
  switch (msg.kind) {
    case 'fileId':
      encoder.onMesg(MesgNum.FILE_ID, {
        type: 'activity',
        manufacturer: 'development',
        product: 0,
        serialNumber: 0,
        timeCreated: msg.timeCreated,
      });
      break;
    case 'set': {
      const fields: Record<string, unknown> = {
        messageIndex: msg.messageIndex,
        setType: msg.setType,
        startTime: msg.startTime,
        timestamp: msg.timestamp,
        duration: msg.durationSec,
      };
      if (msg.setType === 'active') {
        fields.repetitions = msg.repetitions;
        fields.weight = msg.weightKg;
        fields.weightDisplayUnit = msg.weightDisplayUnit;
        if (msg.category) fields.category = [msg.category];
        const subtype = subtypeFor(msg);
        if (subtype !== undefined) fields.categorySubtype = [subtype];
      }
      encoder.onMesg(MesgNum.SET, fields);
      break;
    }
    case 'lap':
      encoder.onMesg(MesgNum.LAP, {
        messageIndex: msg.messageIndex,
        startTime: msg.startTime,
        timestamp: msg.timestamp,
        totalElapsedTime: msg.totalElapsedSec,
        totalTimerTime: msg.totalElapsedSec,
      });
      break;
    case 'session':
      encoder.onMesg(MesgNum.SESSION, {
        messageIndex: msg.messageIndex,
        startTime: msg.startTime,
        timestamp: msg.timestamp,
        sport: 'training',
        subSport: 'strengthTraining',
        totalElapsedTime: msg.totalElapsedSec,
        totalTimerTime: msg.totalElapsedSec,
        firstLapIndex: 0,
        numLaps: msg.numLaps,
      });
      break;
    case 'activity':
      encoder.onMesg(MesgNum.ACTIVITY, {
        timestamp: msg.timestamp,
        totalTimerTime: msg.totalTimerSec,
        numSessions: 1,
        type: 'manual',
      });
      break;
  }
}

/** Encode the session to FIT bytes. */
export async function buildFitBytes(session: WorkoutSession, settings: Settings): Promise<Uint8Array> {
  const { Encoder, Profile } = await import('@garmin/fitsdk');
  const messages = buildFitMessages(session, settings);
  const encoder = new Encoder();

  // Pre-resolve subtype name -> numeric value for each category, once.
  const subtypeFor = (m: Extract<FitMessage, { kind: 'set' }>): number | undefined => {
    if (!m.category || !m.subtypeName) return undefined;
    const enumMap = (Profile as any).types[`${m.category}ExerciseName`] as Record<string, string> | undefined;
    if (!enumMap) return undefined;
    const entry = Object.entries(enumMap).find(([, name]) => name === m.subtypeName);
    return entry ? Number(entry[0]) : undefined;
  };

  for (const msg of messages) {
    applyMessage(encoder, (Profile as any).MesgNum, msg, subtypeFor);
  }
  return encoder.close();
}

/** Encode the session to a downloadable `.FIT` Blob. */
export async function buildFitBlob(session: WorkoutSession, settings: Settings): Promise<Blob> {
  const bytes = await buildFitBytes(session, settings);
  // Copy into a fresh ArrayBuffer so the Blob part type is unambiguous (the
  // encoder's Uint8Array buffer is typed as the wider ArrayBufferLike).
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/octet-stream' });
}

/** A stable, readable filename for the exported file. */
export function fitFileName(session: WorkoutSession): string {
  const date = session.date.slice(0, 10); // YYYY-MM-DD
  return `fivebyfive-${date}-workout-${sessionSlug(session)}.fit`;
}
