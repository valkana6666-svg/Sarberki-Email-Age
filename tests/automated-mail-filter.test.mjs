import test from 'node:test';
import assert from 'node:assert/strict';
import {automatedMailReason} from '../shared-core/automated-mail-filter.mjs';
import {MAILBOX_PROFILES,enabledMailboxProfile,notificationText} from '../shared-core/server-mailbox-profiles.mjs';
import {TEST_GMAIL_ACCOUNT} from '../gmail-policy.mjs';

const human={from:'Teszt Vendég <guest@example.test>',subject:'Érdeklődés a szállásról'};

test('a plain human inquiry is not automated',()=>{
 assert.equal(automatedMailReason(human),null);
 assert.equal(automatedMailReason({...human,'auto-submitted':'no'}),null);
 assert.equal(automatedMailReason({...human,'reply-to':'Másik <other@example.test>'}),null);
 assert.equal(automatedMailReason(undefined),null);
});

test('automated, bulk and auto-reply headers are rejected with fixed codes',()=>{
 assert.equal(automatedMailReason({...human,'auto-submitted':'auto-generated'}),'AUTO_SUBMITTED');
 assert.equal(automatedMailReason({...human,'auto-submitted':'auto-replied'}),'AUTO_SUBMITTED');
 for(const p of ['bulk','list','junk','auto_reply','BULK'])assert.equal(automatedMailReason({...human,precedence:p}),'BULK_OR_LIST',p);
 assert.equal(automatedMailReason({...human,'list-id':'<news.example.test>'}),'BULK_OR_LIST');
 assert.equal(automatedMailReason({...human,'list-unsubscribe':'<mailto:u@example.test>'}),'BULK_OR_LIST');
 assert.equal(automatedMailReason({...human,'x-autoreply':'yes'}),'AUTO_REPLY');
 assert.equal(automatedMailReason({...human,'x-auto-response-suppress':'All'}),'AUTO_REPLY');
});

test('system senders are rejected; similar human local parts are not',()=>{
 for(const f of ['noreply@example.test','No-Reply <no-reply@example.test>','donotreply@example.test','do-not-reply@x.test','MAILER-DAEMON@example.test','postmaster@example.test','bounce+abc@example.test','notifications@example.test'])
  assert.equal(automatedMailReason({...human,from:f}),'SYSTEM_SENDER',f);
 for(const f of ['noreen@example.test','replyguy@example.test','post@example.test'])assert.equal(automatedMailReason({...human,from:f}),null,f);
});

test('booking-system (Previo) mail is rejected by From, Sender, Reply-To or Return-Path domain, including subdomains',()=>{
 assert.equal(automatedMailReason({...human,from:'Previo <info@previo.cz>'}),'BOOKING_SYSTEM_SENDER');
 assert.equal(automatedMailReason({...human,from:'x@mail.previo.app'}),'BOOKING_SYSTEM_SENDER');
 assert.equal(automatedMailReason({...human,'return-path':'<bounce-1@smtp.previo.cz>'}),'BOOKING_SYSTEM_SENDER');
 assert.equal(automatedMailReason({...human,sender:'robot@previo.hu'}),'BOOKING_SYSTEM_SENDER');
 assert.equal(automatedMailReason({...human,from:'guest@notprevio.cz'}),null);
 assert.equal(automatedMailReason({...human,from:'guest@previo.cz.example.test'}),null);
});

test('own-mailbox sender is rejected only when the profile asks for it',()=>{
 const own={...human,from:'Sárberki <INFO@sarberkito.hu>'};
 assert.equal(automatedMailReason(own,{ownAddresses:['info@sarberkito.hu'],blockOwnSender:true}),'OWN_MAILBOX_SENDER');
 assert.equal(automatedMailReason(own,{ownAddresses:['info@sarberkito.hu'],blockOwnSender:false}),null);
 assert.equal(automatedMailReason(human,{ownAddresses:['info@sarberkito.hu'],blockOwnSender:true}),null);
});

test('only the TEST mailbox profile is enabled; the live profile fails closed',()=>{
 const t=enabledMailboxProfile('sarberki-test');
 assert.equal(t.account,TEST_GMAIL_ACCOUNT);assert.equal(t.requireTestSubject,true);assert.equal(t.sourceScope,'test-mailbox-source-v1');
 assert.equal(MAILBOX_PROFILES['sarberki-live'].account,'info@sarberkito.hu');
 assert.equal(MAILBOX_PROFILES['sarberki-live'].enabled,false);
 assert.equal(MAILBOX_PROFILES['sarberki-live'].blockOwnSender,true);
 assert.throws(()=>enabledMailboxProfile('sarberki-live'),/MAILBOX_PROFILE_DISABLED/);
 for(const id of ['unknown','','__proto__','constructor',undefined])assert.throws(()=>enabledMailboxProfile(id),/MAILBOX_PROFILE_UNKNOWN/,String(id));
 assert.equal(Object.isFrozen(MAILBOX_PROFILES)&&Object.isFrozen(t),true);
});

test('notifications: TEST keeps synthetic headers; live carries no sender or subject',()=>{
 const h={from:'Vendég <guest@example.test>',subject:'Érdeklődés'};
 assert.equal(notificationText(MAILBOX_PROFILES['sarberki-test'],h),'Új levél érkezett a Sárberki tesztfiókba.\nFeladó: Vendég <guest@example.test>\nTárgy: Érdeklődés');
 const live=notificationText(MAILBOX_PROFILES['sarberki-live'],h);
 assert.equal(live.includes('guest@example.test')||live.includes('Vendég')||live.includes('Érdeklődés'),false);
 for(const p of [undefined,null,{},{notificationIncludesHeaders:'true'}])assert.equal(notificationText(p,h).includes('guest@'),false,JSON.stringify(p));
});
