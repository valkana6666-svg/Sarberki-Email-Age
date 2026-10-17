import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplyDraft} from '../sarberki-core.mjs';
import {availabilitySentence,requestedAvailabilitySentence} from '../availability-recommend.mjs';

const languages=['hu','de','en','si'];
const request={original:'Synthetic booking inquiry',arrival:'2026-11-05',departure:'2026-11-07',adults:4,guests:4,children:0,phone:'000-TEST',cabin:'Deluxe'};

for(const language of languages){
  test(`V1 language ${language}: confirmed capacity never exposes PMS internals`,()=>{
    const result=availabilitySentence({available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}]},language);
    assert.match(result,/Deluxe/u);
    assert.doesNotMatch(result,/Previo|mapping|pool|7A|10C/iu);
  });
  test(`V1 language ${language}: unknown capacity is not presented as available`,()=>{
    const result=availabilitySentence({available_options:[]},language);
    assert.doesNotMatch(result,/Deluxe/u);
    assert.ok(result.length>10);
    assert.notEqual(result,availabilitySentence({available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}]},language));
  });
  test(`V1 language ${language}: draft retains requested stay and cabin`,()=>{
    const draft=buildReplyDraft({...request,language});
    assert.match(draft,/Deluxe/u);
    // The guest's arrival and departure must survive localized rendering.
    const dateMarkers=language==='en'?['5 November 2026','7 November 2026']:['05.11.2026','07.11.2026'];
    for(const marker of dateMarkers) assert.ok(draft.includes(marker),`${language}: missing stay date ${marker}`);
    assert.ok(draft.length>20);
    assert.doesNotMatch(draft,/7A|10C|\bpool\b|\bmapping\b/iu);
  });
}

for(const language of languages){
  test(`V1 language ${language}: unverified sold-out evidence is never definitive`,()=>{
    const unknown=availabilitySentence({
      available_options:[],
      unavailable_options:[{label:'Deluxe',availability:'unavailable',availability_verified:false}]
    },language);
    const verified=availabilitySentence({
      available_options:[],
      unavailable_options:[{label:'Deluxe',availability:'unavailable',availability_verified:true}]
    },language);
    assert.ok(unknown.length>10);
    assert.notEqual(unknown,verified,'Unverified and verified capacity must produce distinct replies');
  });
}

for(const language of languages){
  test(`V1 language ${language}: requested Deluxe is not declared sold out without verified evidence`,()=>{
    const unknown=requestedAvailabilitySentence({unavailable_options:[{key:'deluxe',label:'Deluxe',availability:'unavailable',availability_verified:false}]},'Deluxe',language);
    const verified=requestedAvailabilitySentence({unavailable_options:[{key:'deluxe',label:'Deluxe',availability:'unavailable',availability_verified:true}]},'Deluxe',language);
    assert.match(unknown,/Deluxe/u);
    assert.notEqual(unknown,verified);
  });
  test(`V1 language ${language}: verified requested Deluxe is distinguished from unknown`,()=>{
    const available=requestedAvailabilitySentence({available_options:[{key:'deluxe',label:'Deluxe',availability:'available',availability_verified:true}]},'Deluxe',language);
    const unknown=requestedAvailabilitySentence({unverified_options:[{key:'deluxe',label:'Deluxe',availability:'unverified',availability_verified:false}]},'Deluxe',language);
    assert.notEqual(available,unknown);
    assert.match(available,/Deluxe/u);
  });
}

for(const language of languages){
  test(`V1 language ${language}: contradictory capacity evidence never becomes a definitive offer`,()=>{
    const contradictory=availabilitySentence({
      available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:false}],
      unavailable_options:[{label:'Deluxe',availability:'unavailable',availability_verified:false}]
    },language);
    const confirmed=availabilitySentence({
      available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}],
      unavailable_options:[]
    },language);
    assert.notEqual(contradictory,confirmed);
    assert.doesNotMatch(contradictory,/Deluxe/u);
  });
}

for(const language of languages){
  for(const intent of ['cancellation_request','modification_request']){
    test(`V1 language ${language}: ${intent} is only acknowledged, never confirmed`,()=>{
      const draft=buildReplyDraft({...request,language,intent});
      assert.ok(draft.length>20);
      assert.doesNotMatch(draft,/Previo|7A|10C|\bpool\b|\bmapping\b/iu);
      const reviewMarkers={
        hu:/Megkaptuk.*kérelmét.*Hamarosan/iu,
        de:/erhalten.*prüfen/iu,
        en:/received.*request.*review/iu,
        si:/Prejeli.*zahtevo.*preverili/iu
      };
      assert.match(draft,reviewMarkers[language]);
    });
  }
}
