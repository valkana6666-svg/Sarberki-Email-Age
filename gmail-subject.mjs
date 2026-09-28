export const APPROVED_SUBJECTS = Object.freeze([
  'érdeklődés a szállásról',
  'érdeklődés a szallasrol',
  'érdeklődés szállásról'
]);

export function isApprovedSubject(subject) {
  return typeof subject === 'string' && APPROVED_SUBJECTS.includes(subject.trim().toLocaleLowerCase('hu-HU'));
}
