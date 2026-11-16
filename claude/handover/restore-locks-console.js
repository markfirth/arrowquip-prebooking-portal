/* Arrowquip TRAVEL — restore missing time locks (run in a signed-in pre-bookings.com tab)
 * Prerequisites: time-lock fix live (index sha 0b2c7498…); Mark pauses editing ~1 minute.
 * Merge rule: restored = v2204.lock ∪ current.lock; CURRENT wins on key clashes.
 * Never touches a/appt/time/logi/confirmations — only TLE.lock keys.
 *
 * Usage: paste into DevTools console on https://pre-bookings.com while signed in.
 */
(async function restoreMissingLocks(){
  if(typeof SB==='undefined'||!SB){ console.error('SB client missing — are you on the live app signed in?'); return; }
  if(typeof PB_READONLY!=='undefined'&&PB_READONLY){ console.error('Readonly mode — open without ?readonly=1'); return; }
  const PLAN_ID=(typeof PLAN_KEY==='string'&&PLAN_KEY)||'plan';

  // 1) Load history snapshot for version 2204 (live history if still retained)
  let hist=await SB.from('prebooking_history').select('new_version,prev_version,saved_at,data')
    .eq('row_id',PLAN_ID).eq('new_version',2204).limit(1);
  if(hist.error){ console.error('history query failed', hist.error); return; }
  if(!hist.data||!hist.data.length){
    console.error('Version 2204 not in live history. Need pb_backup_20261116 via SQL. Aborting.');
    return;
  }
  const snap=hist.data[0].data||{};
  const oldLock=(snap.tle&&snap.tle.lock)||{};
  const curLock=(TLE&&TLE.lock)||{};
  const before=Object.keys(curLock).length;
  const missing=[];
  Object.keys(oldLock).forEach(function(k){ if(!curLock[k]) missing.push(k); });
  console.log('v2204 locks:', Object.keys(oldLock).length, 'current:', before, 'missing to add:', missing.length, missing);

  if(!missing.length){ console.log('Nothing to restore — current already has all v2204 keys (or more).'); return; }

  // 2) Merge: only ADD missing keys; never remove or change existing
  missing.forEach(function(k){ TLE.lock[k]=oldLock[k]; });
  console.log('TLE.lock after merge:', Object.keys(TLE.lock).length);

  // 3) Save through the app path (version + history + log)
  if(typeof savePlan!=='function'){ console.error('savePlan missing'); return; }
  savePlan();
  console.log('savePlan() called. Watch for “Saved to cloud”. Then hard-reload a second browser and confirm locks persist.');
  return {added:missing, lockCount:Object.keys(TLE.lock).length, from:before};
})();
