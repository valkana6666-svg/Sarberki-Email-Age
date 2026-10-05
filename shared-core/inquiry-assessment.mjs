// PMS-independent validation/review layer for accommodation inquiries.
// It decides whether normalized booking facts are complete and internally consistent.
// Business-specific pricing, discounts, house mappings and PMS calls do not belong here.

function isUnknownAccommodation(value){
  return !value || (typeof value==='string' && value.trim().startsWith('?'));
}

export function assessAccommodationInquiry({
  arrival=null,
  departure=null,
  accommodation=null,
  guests=null,
  adults=null,
  children=null,
  childAges=[]
}={}){
  const missing=[];
  const contradictions=[];

  if(!arrival || !departure) missing.push('dates');
  if(isUnknownAccommodation(accommodation)) missing.push('accommodation');
  if(!(Number.isInteger(adults) && adults>0)) missing.push('adults');
  if(!Number.isInteger(children) || children<0) missing.push('children_status');

  const ages=Array.isArray(childAges)?childAges:[];
  if(Number.isInteger(children) && children>0 && ages.length<children){
    missing.push('child_ages');
  }

  if(Number.isInteger(guests) && Number.isInteger(adults) && Number.isInteger(children)
      && guests!==adults+children){
    contradictions.push(Object.freeze({
      code:'guest_total_mismatch',
      message:`A teljes vendéglétszám (${guests}) nem egyezik a felnőttek és gyermekek összegével (${adults+children}).`
    }));
  }

  if(Number.isInteger(children) && children>=0 && ages.length>children){
    contradictions.push(Object.freeze({
      code:'too_many_child_ages',
      message:`Több gyermekéletkor érkezett (${ages.length}), mint a megadott gyermeklétszám (${children}).`
    }));
  }

  const uniqueMissing=Object.freeze([...new Set(missing)]);
  const frozenContradictions=Object.freeze([...contradictions]);

  return Object.freeze({
    missing:uniqueMissing,
    contradictions:frozenContradictions,
    human_review_required:frozenContradictions.length>0,
    ready:uniqueMissing.length===0 && frozenContradictions.length===0
  });
}
