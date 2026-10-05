import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/recorded-previo-quotes.json' with {type:'json'};
import {validateQuote} from '../price-quote.mjs';

const CASES=fixtures.cases;
function sameChildren(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i]);}

export async function fetchRecordedPrevioQuote(raw){
  const input=validateQuote(raw);
  const match=CASES.find(x=>x.arrival===input.arrival&&x.departure===input.departure&&x.cabin===input.cabin&&x.adults===input.adults&&sameChildren(x.children,input.children));
  if(!match) throw Error('Ehhez a tesztesethez nincs rögzített Previo-válasz. Élő árlekérés nem történt.');
  return {
    ...input,
    status:'review_required',
    availability:'available',
    source:'Rögzített Previo tesztadat',
    checkedAt:match.verifiedAt?match.verifiedAt+'T00:00:00.000Z':'2026-09-28T17:00:00.000Z',
    availableUnits:match.availableUnits,
    accommodation:match.accommodation,
    tourismTax:match.tourismTax,
    total:match.total,
    currency:'HUF',
    bookingCompleted:false,
    historicalFixture:true
  };
}

test('recorded child matrix keeps 2/5/13/17 prices stable and 18-year-old as adult IFA control',()=>{
  for(const cabin of ['deluxe','family','vip']){
    const childRows=CASES.filter(x=>x.cabin===cabin&&[2,5,13,17].includes(x.controlAge));
    assert.equal(childRows.length,4,cabin);
    const accommodation=new Set(childRows.map(x=>x.accommodation));
    const tax=new Set(childRows.map(x=>x.tourismTax));
    const total=new Set(childRows.map(x=>x.total));
    assert.equal(accommodation.size,1,cabin+' accommodation');
    assert.deepEqual([...tax],[2200],cabin+' child IFA');
    assert.equal(total.size,1,cabin+' child total');
    const adult=CASES.find(x=>x.cabin===cabin&&x.controlAge===18);
    assert.ok(adult,cabin+' 18 control');
    assert.equal(adult.accommodation,childRows[0].accommodation,cabin+' accommodation unchanged');
    assert.equal(adult.tourismTax,3300,cabin+' adult IFA');
    assert.equal(adult.total-childRows[0].total,1100,cabin+' two-night IFA delta');
  }
});

test('recorded quote lookup returns verified child fixture without live Previo',async()=>{
  const q=await fetchRecordedPrevioQuote({arrival:'2026-10-16',departure:'2026-10-18',cabin:'family',adults:2,children:[13]});
  assert.equal(q.total,106200);
  assert.equal(q.tourismTax,2200);
  assert.equal(q.historicalFixture,true);
  assert.equal(q.bookingCompleted,false);
});
