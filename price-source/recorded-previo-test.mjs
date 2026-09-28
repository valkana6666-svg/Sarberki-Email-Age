import {validateQuote} from '../price-quote.mjs';

// Historical test fixtures reconstructed from previously checked Previo/UI results.
// Never use these values as a current guest quote.
const CASES=[
  {arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[],availableUnits:4,accommodation:120000,tourismTax:2200,total:122200},
  {arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[7,11],availableUnits:4,accommodation:120000,tourismTax:2200,total:122200},
  {arrival:'2026-10-16',departure:'2026-10-18',cabin:'family',adults:2,children:[],availableUnits:3,accommodation:104000,tourismTax:2200,total:106200}
];

function sameChildren(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i]);}

export async function fetchRecordedPrevioQuote(raw){
  const input=validateQuote(raw);
  const match=CASES.find(x=>x.arrival===input.arrival&&x.departure===input.departure&&x.cabin===input.cabin&&x.adults===input.adults&&sameChildren(x.children,input.children));
  if(!match) throw Error('Ehhez a tesztesethez nincs rögzített Previo-válasz. Élő árlekérés nem történt.');
  return {
    ...input,
    status:'review_required',
    availability:'available',
    source:'Rögzített Previo tesztadat (2026-09-28)',
    checkedAt:'2026-09-28T17:00:00.000Z',
    availableUnits:match.availableUnits,
    accommodation:match.accommodation,
    tourismTax:match.tourismTax,
    total:match.total,
    currency:'HUF',
    bookingCompleted:false,
    historicalFixture:true
  };
}
