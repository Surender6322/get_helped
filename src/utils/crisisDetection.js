// Lightweight, locally-evaluated detection of crisis signals in user
// messages. Returns one of:
//   - { severity: 'high', matched }  — explicit suicidal / self-harm intent
//   - { severity: 'medium', matched } — distress signals worth flagging
//   - { severity: 'none' }
//
// Used by Chat.jsx to:
//   1. Soft-prompt the user with helpline info when they're typing a high-severity message.
//   2. Visually flag incoming messages on the helper's side so they can prioritise.
//
// IMPORTANT: this is a safety *aid*, not a substitute for professional
// triage. We err on the side of false positives to surface the emergency
// modal more often, never less.

const HIGH = [
  /\bkill(?:ing)?\s+myself\b/i,
  /\bend(?:ing)?\s+(?:my|this)\s+life\b/i,
  /\b(?:want|wanna|going)\s+to\s+die\b/i,
  /\bi\s+(?:wish|want)\s+i\s+(?:was|were)\s+dead\b/i,
  /\bsuicid(?:e|al|ing)\b/i,
  /\bhurt(?:ing)?\s+myself\b/i,
  /\bself[\s-]?harm/i,
  /\bcut(?:ting)?\s+myself\b/i,
  /\boverdose\b/i,
  /\bjump(?:ing)?\s+off\b/i,
  /\bno\s+(?:reason|point)\s+to\s+live\b/i,
  /\bi\s+can'?t\s+(?:do|take)\s+this\s+anymore\b/i,
  /\bdon'?t\s+want\s+to\s+(?:live|exist|wake\s+up)\b/i,
  /\bgoodbye\s+forever\b/i,
];

const MEDIUM = [
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\bnobody\s+(?:cares|would\s+miss\s+me)\b/i,
  /\bgive\s+up\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\b(?:i\s+am|i'?m)\s+(?:done|finished)\b/i,
  /\beverything\s+(?:is|feels)\s+pointless\b/i,
  /\bi\s+hate\s+myself\b/i,
];

export function detectCrisisSignals(text) {
  if (!text || typeof text !== 'string') return { severity: 'none' };
  for (const re of HIGH) {
    if (re.test(text)) return { severity: 'high', matched: re.source };
  }
  for (const re of MEDIUM) {
    if (re.test(text)) return { severity: 'medium', matched: re.source };
  }
  return { severity: 'none' };
}
