/* Arrowquip TRAVEL — time-lock DRY RUN (signed-in browser on pre-bookings.com)
 * READ ONLY — does not call savePlan / does not mutate TLE.
 * Paste into DevTools console while signed in. Prefer backup SQL when available;
 * this uses live history v2204 if still retained in the rolling 100 rows.
 */
(async function lockDryRun(){
  if(typeof SB==='undefined'||!SB){ console.error('SB missing — open the live signed-in app'); return; }
  const PLAN_ID=(typeof PLAN_KEY==='string'&&PLAN_KEY)||'plan';
  const hist=await SB.from('prebooking_history').select('new_version,prev_version,saved_at,data')
    .eq('row_id',PLAN_ID).eq('new_version',2204).limit(1);
  if(hist.error){ console.error('history error', hist.error); return; }
  if(!hist.data||!hist.data.length){
    console.warn('v2204 not in live history. Use claude/handover/lock-dry-run.sql against pb_backup_20261116 instead.');
    return {ok:false, reason:'v2204_not_in_live_history'};
  }
  const oldLock=(hist.data[0].data&&hist.data[0].data.tle&&hist.data[0].data.tle.lock)||{};
  const curLock=(typeof TLE!=='undefined'&&TLE.lock)||{};
  const oldKeys=Object.keys(oldLock);
  const curKeys=Object.keys(curLock);
  const missing=oldKeys.filter(k=>!curLock[k]);
  const already=oldKeys.filter(k=>!!curLock[k]);
  const liveOnly=curKeys.filter(k=>!oldLock[k]);
  const summary={
    mode:'DRY_RUN_NO_WRITE',
    v2204_lock_count:oldKeys.length,
    live_lock_count:curKeys.length,
    missing_to_add:missing.length,
    already_present:already.length,
    live_only_newer:liveOnly.length,
    would_add_keys:missing.slice().sort(),
    note:'Current locks win on clashes. Appointments/bookings untouched. Await Mark approval before restore.'
  };
  console.log(summary);
  console.table(missing.map(k=>({key:k, action:'ADD from v2204'})));
  return summary;
})();