import fs from 'node:fs';
import { cases } from './email-stress-cases.mjs';
import { evaluate } from './email-stress-harness.mjs';
const results=cases.map(c=>{
 const r=evaluate(c);const failures=[];
 for(const [k,v] of Object.entries(c.expected))if(JSON.stringify(r.actual[k])!==JSON.stringify(v))failures.push(k);
 for(const [channel,draft] of [['core',r.draft],['ui',r.ui.draft],...(r.gmail?[['gmail',r.gmail.reply_draft]]:[])]){
  if(c.reply.contains&&!c.reply.contains.test(draft))failures.push(channel+' reply missing');
  if(c.reply.absent&&c.reply.absent.test(draft))failures.push(channel+' reply forbidden');
 }
 if(c.expected.cabin?.startsWith('?')&&['VIP','Deluxe','Családi','Osztott'].includes(r.ui.values.unit))failures.push('UI cabin');
 if(c.expected.arrival===null&&r.ui.values.arrival)failures.push('UI dates');
 return {...c,reply:{contains:String(c.reply.contains||''),absent:String(c.reply.absent||'')},...r,failures};
});
const summary={total:results.length,failed:results.filter(r=>r.failures.length).length,groups:[...new Set(results.filter(r=>r.failures.length).map(r=>r.group))]};
fs.writeFileSync(process.argv[2]||'/tmp/sarberki-stress.json',JSON.stringify({summary,results},null,2));
console.log(summary);
