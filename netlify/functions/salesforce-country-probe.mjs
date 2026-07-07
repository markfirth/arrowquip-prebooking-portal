/** TEMPORARY read-only probe: BillingCountry/StateCode for the 2 Exports dealers.
 *  To be removed after reporting. READ-ONLY. Access-gated. */
const ACCESS_TOKEN = 'aq-ctry-5a1c9e'
const IDS = ['001ON00000JHTrYYAX', '001ON00000JHTrXYAX'] // Wise Agriculture, Sarl Sabourdy
function readEnv(n){let v=String(process.env[n]||'').trim();const p=`${n}=`;if(v.startsWith(p))v=v.slice(p.length).trim();return v}
function apiV(){const v=readEnv('SALESFORCE_API_VERSION');return !v?'v60.0':v.startsWith('v')?v:`v${v}`}
function json(b,s=200){return new Response(JSON.stringify(b,null,2),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}})}
async function tok(){const u=readEnv('SALESFORCE_INSTANCE_URL'),ci=readEnv('SALESFORCE_CLIENT_ID'),cs=readEnv('SALESFORCE_CLIENT_SECRET');
  const r=await fetch(`${u.replace(/\/+$/,'')}/services/oauth2/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:ci,client_secret:cs}).toString()});
  const t=await r.text();let d=null;try{d=JSON.parse(t)}catch{d=null};if(!r.ok||!d?.access_token)throw new Error((d&&(d.error_description||d.error))||`token ${r.status}`);return {a:d.access_token,u:(d.instance_url||u).replace(/\/+$/,'')}}
export default async function handler(req){
  const url=new URL(req.url); if(url.searchParams.get('k')!==ACCESS_TOKEN) return json({ok:false,error:'Not found'},404)
  try{ const {a,u}=await tok(); const inIds=IDS.map(i=>`'${i}'`).join(', ')
    const q=`SELECT Id, Name, BillingStateCode, BillingState, BillingCountry, BillingCountryCode FROM Account WHERE Id IN (${inIds})`
    const r=await fetch(`${u}/services/data/${apiV()}/query?q=${encodeURIComponent(q)}`,{headers:{Authorization:`Bearer ${a}`,'Content-Type':'application/json'}})
    const t=await r.text();let d=null;try{d=JSON.parse(t)}catch{d=null};if(!r.ok||!Array.isArray(d?.records))throw new Error((t||`query ${r.status}`).slice(0,200))
    return json({ok:true,records:d.records.map(x=>({Name:x.Name,BillingStateCode:x.BillingStateCode,BillingState:x.BillingState,BillingCountry:x.BillingCountry,BillingCountryCode:x.BillingCountryCode}))})
  }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},502)}
}
export const config={path:'/api/salesforce-country-probe'}
