import test from 'node:test';
import assert from 'node:assert/strict';

// The module calls initViewSwitch() on import; without a document it must do nothing.
const {initViewSwitch}=await import('../napi-kezelo/napi-view.mjs');
function doc(){
 const classes=new Set(['simple']),attrs={},listeners=[];
 const button={textContent:'',setAttribute:(k,v)=>{attrs[k]=v;},addEventListener:(t,fn)=>listeners.push(fn),click:()=>listeners.forEach(fn=>fn())};
 return {classes,attrs,button,getElementById:id=>id==='view-toggle'?button:null,body:{classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c)}}};
}
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),m};};

test('simple view is the default; the toggle switches and remembers the choice per device',()=>{
 const d=doc(),s=store();
 const view=initViewSwitch(d,()=>s);
 assert.equal(view.mode(),'simple');assert.ok(d.classes.has('simple'));assert.equal(d.button.textContent,'Teljes nézet');assert.equal(d.attrs['aria-pressed'],'false');
 d.button.click();
 assert.equal(view.mode(),'full');assert.ok(!d.classes.has('simple'));assert.equal(d.button.textContent,'Egyszerű nézet');assert.equal(s.m.get('sarberki-napi-view'),'full');
 const again=doc();assert.equal(initViewSwitch(again,()=>s).mode(),'full','remembered');assert.ok(!again.classes.has('simple'));
});
test('blocked storage falls back to the simple view and the toggle still works; no button -> no-op',()=>{
 const d=doc(),broken=()=>{throw Error('SecurityError');};
 const view=initViewSwitch(d,broken);assert.equal(view.mode(),'simple');
 d.button.click();assert.equal(view.mode(),'full');
 assert.equal(initViewSwitch({getElementById:()=>null,body:null}),null);
 assert.equal(initViewSwitch(undefined),null);
});
