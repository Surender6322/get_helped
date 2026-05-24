// Server-side crisis classifier — kept in sync with src/utils/crisisDetection.js
// We duplicate (rather than import from the client) because Cloud Functions
// runs in a different module graph and we want this to be self-contained.

const HIGH_EN = [
  /\bkill(?:ing)?\s+myself\b/i,
  /\bend(?:ing)?\s+(?:my|this)\s+life\b/i,
  /\b(?:want|wanna|going|plan(?:ning)?)\s+to\s+die\b/i,
  /\bi\s+(?:wish|want)\s+i\s+(?:was|were)\s+dead\b/i,
  /\bsuicid(?:e|al|ing)\b/i,
  /\bhurt(?:ing)?\s+myself\b/i,
  /\bself[\s-]?harm/i,
  /\bcut(?:ting)?\s+myself\b/i,
  /\boverdose\b/i,
  /\bjump(?:ing)?\s+off\b/i,
  /\bhang(?:ing)?\s+myself\b/i,
  /\bno\s+(?:reason|point)\s+to\s+live\b/i,
  /\bi\s+can'?t\s+(?:do|take)\s+this\s+anymore\b/i,
  /\bdon'?t\s+want\s+to\s+(?:live|exist|wake\s+up)\b/i,
  /\bgoodbye\s+forever\b/i,
  /\bnot\s+going\s+to\s+make\s+it\b/i,
  /\b(?:better|easier)\s+if\s+i\s+(?:was|were)\s+(?:dead|gone)\b/i,
];

const HIGH_HINGLISH = [
  /\bmar\s*[njr]?a?\s+hai\b/i,
  /\bmar\s*j(?:a|au|aau|aaun|aaunga|aaungi)\b/i,
  /\bmar\s*j(?:a|au|aau)\s*[ck]a?\s+(?:soch|man)\b/i,
  /\bjeena\s+nah?(?:i|in|i+n)\s+chahta\b/i,
  /\bjeena\s+(?:nahi|na)\s+(?:hai|chahti|chahta)\b/i,
  /\bkhatam\s+(?:kar(?:na|lu(?:ng|n))|ho\s+(?:jana|jau))\b/i,
  /\bkhud\s*(?:ko|kushi)\b/i,
  /\bkhud(?:k|-)kushi\b/i,
  /\bsuicide\s+kar(?:na|ne|loo|loonga|loongi|lo)\b/i,
  /\bzeher\s+(?:kha(?:na)?|peene|le(?:na|loonga))\b/i,
  /\bphansi\s+(?:laga|le)\b/i,
  /\bcut\s+(?:karna|kar(?:loo|loonga|li))\b/i,
  /\bnas(?:e|ein)\s+kat\b/i,
  /\bblade\s+(?:lag|le|chal)\b/i,
  /\b(?:bahut|bohot)\s+thak\s+gay[ai]\s+hu(?:n|in)?\s*[,.]?\s*ab\s+(?:nah?in?|nahi)\b/i,
  /\bzinda\s+nah?(?:i|in)\s+rehna\b/i,
  /\bzinda\s+rehne\s+ka\s+(?:man|mood|dil)\s+nah?(?:i|in)\b/i,
  /\bjaan\s+de\s+(?:doonga|doongi|du(?:n|in))\b/i,
];

const HIGH_HI = [
  /मरना\s*है/u,
  /मर\s*जाऊँगा|मर\s*जाऊँगी|मर\s*जाना\s*है|मर\s*जाऊं|मर\s*जाऊँ/u,
  /मरने\s*का\s*(?:मन|सोच)/u,
  /जीना\s*नहीं\s*(?:है|चाहता|चाहती)/u,
  /खत्म\s*(?:कर|हो)/u,
  /ख़त्म\s*(?:कर|हो)/u,
  /खुदकुशी|खुद\s*कुशी/u,
  /आत्महत्या/u,
  /खुद\s*को\s*(?:नुक़सान|नुकसान|चोट|मार)/u,
  /जान\s*दे\s*(?:दूँगा|दूँगी|देना)/u,
  /फाँसी\s*(?:लग|ले)/u,
  /अब\s*(?:और|बस)\s*(?:नहीं|नही)/u,
  /जीने\s*का\s*(?:मन|कारण)\s*नहीं/u,
];

const HIGH_TA = [/சாக\s*வேண்டும்/u, /தற்கொலை/u, /உயிர்\s*விட/u];
const HIGH_BN = [/মরতে\s*চাই/u, /আত্মহত্যা/u, /বাঁচতে\s*চাই\s*না/u];
const HIGH_MR = [/मरायचंय|मरायचं\s*आहे/u, /जगायचं\s*नाही/u];

const MEDIUM_EN = [
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\bnobody\s+(?:cares|would\s+miss\s+me)\b/i,
  /\bgive\s+up\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\b(?:i\s+am|i'?m)\s+(?:done|finished|exhausted|drained|empty)\b/i,
  /\beverything\s+(?:is|feels)\s+pointless\b/i,
  /\bi\s+hate\s+myself\b/i,
];
const MEDIUM_HINGLISH = [
  /\bthak\s+gay[ai]\s+hu(?:n|in)?\b/i,
  /\bbas\s+ho\s+gaya\b/i,
  /\bdil\s+(?:bahut|bohot|bohut)\s+(?:bhar|toot)/i,
  /\bakela\s+(?:hu|hoon|feel)\b/i,
];
const MEDIUM_HI = [
  /निराशा|निराश/u,
  /बेकार\s*हूँ|बेकार\s*हूं/u,
  /थक\s*गया\s*हूँ|थक\s*गई\s*हूँ/u,
];

const HIGH_BUCKETS = [
  ['en', HIGH_EN],
  ['hinglish', HIGH_HINGLISH],
  ['hi', HIGH_HI],
  ['ta', HIGH_TA],
  ['bn', HIGH_BN],
  ['mr', HIGH_MR],
];
const MEDIUM_BUCKETS = [
  ['en', MEDIUM_EN],
  ['hinglish', MEDIUM_HINGLISH],
  ['hi', MEDIUM_HI],
];

export function detectCrisisSignals(text) {
  if (!text || typeof text !== 'string') return { severity: 'none' };
  for (const [lang, bucket] of HIGH_BUCKETS) {
    for (const re of bucket) if (re.test(text)) return { severity: 'high', lang };
  }
  for (const [lang, bucket] of MEDIUM_BUCKETS) {
    for (const re of bucket) if (re.test(text)) return { severity: 'medium', lang };
  }
  return { severity: 'none' };
}

export function crisisAcknowledgement(lang) {
  if (lang === 'hi') return 'जो तुम महसूस कर रहे हो, वो बहुत भारी है — और तुम अकेले नहीं हो। ';
  if (lang === 'hinglish') return 'Jo tum feel kar rahe ho, woh bahut bhaari hai — aur tum akele bilkul nahi ho. ';
  if (lang === 'ta') return 'நீங்கள் தனிமையாக இல்லை. ';
  if (lang === 'bn') return 'তুমি একা নও। ';
  if (lang === 'mr') return 'तू एकटा नाहीस. ';
  return "What you're feeling is real, and you're not alone. ";
}
