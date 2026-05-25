// Lightweight, locally-evaluated detection of crisis signals in user
// messages. Returns one of:
//   - { severity: 'high', matched, lang } — explicit suicidal / self-harm intent
//   - { severity: 'medium', matched, lang } — distress signals worth flagging
//   - { severity: 'none' }
//
// Used by Chat.jsx and Companion.jsx to:
//   1. Soft-prompt the user with helpline info when they're typing a high-severity message.
//   2. Visually flag incoming messages on the helper's side so they can prioritise.
//   3. Inject a forced-empathy + helpline system message into the AI Companion.
//
// IMPORTANT: this is a safety *aid*, not a substitute for professional
// triage. We err on the side of false positives to surface the emergency
// modal more often, never less.
//
// Coverage:
//   - English
//   - Hindi (Devanagari script)
//   - Hinglish (Roman-script Hindi, the most common register in young Indian users)
//   - Light coverage of Tamil / Bengali / Marathi (Devanagari) / Punjabi for the most-explicit phrases
//
// Patterns are deliberately permissive. False positives are cheap (we
// just nudge the user toward a helpline). False negatives can cost lives.

// ----- HIGH SEVERITY -------------------------------------------------

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

// Hinglish — Roman-script Hindi/Urdu. Order: most explicit first.
// Variants: "marna hai" / "mar na hai" / "marrna hai", spelling drift
// is the rule, not the exception, so all patterns are tolerant.
const HIGH_HINGLISH = [
  /\bmar\s*[njr]?a?\s+hai\b/i,                            // marna hai, mar na hai
  /\bmar\s*j(?:a|au|aau|aaun|aaunga|aaungi)\b/i,           // mar jau / mar jaau / mar jaaungi
  /\bmar\s*j(?:a|au|aau)\s*[ck]a?\s+(?:soch|man)\b/i,      // mar jane ka man / soch
  /\bjeena\s+nah?(?:i|in|i+n)\s+chahta\b/i,                // jeena nahi chahta
  /\bjeena\s+(?:nahi|na)\s+(?:hai|chahti|chahta)\b/i,
  /\bkhatam\s+(?:kar(?:na|lu(?:ng|n))|ho\s+(?:jana|jau))\b/i, // khatam karna / khatam kar lunga / khatam ho jau
  /\bkhud\s*(?:ko|kushi)\b/i,                              // khud ko (hurt karna), khudkushi
  /\bkhud(?:k|-)kushi\b/i,
  /\bsuicide\s+kar(?:na|ne|loo|loonga|loongi|lo)\b/i,
  /\bzeher\s+(?:kha(?:na)?|peene|le(?:na|loonga))\b/i,     // zeher khaana / zeher pi lena
  /\bphansi\s+(?:laga|le)\b/i,                             // phansi laga lunga
  /\bcut\s+(?:karna|kar(?:loo|loonga|li))\b/i,             // cut karna hai / cut kar li
  /\bnas(?:e|ein)\s+kat\b/i,                               // nas / nasein katna
  /\bblade\s+(?:lag|le|chal)\b/i,                          // blade laga li / blade chala
  /\b(?:bahut|bohot)\s+thak\s+gay[ai]\s+hu(?:n|in)?\s*[,.]?\s*ab\s+(?:nah?in?|nahi)\b/i,
  /\bzinda\s+nah?(?:i|in)\s+rehna\b/i,                     // zinda nahi rehna
  /\bzinda\s+rehne\s+ka\s+(?:man|mood|dil)\s+nah?(?:i|in)\b/i,
  /\bjaan\s+de\s+(?:doonga|doongi|du(?:n|in))\b/i,         // jaan de dunga
];

// Hindi (Devanagari)
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

// Tamil
const HIGH_TA = [
  /சாக\s*வேண்டும்/u,
  /தற்கொலை/u,
  /உயிர்\s*விட/u,
];

// Bengali
const HIGH_BN = [
  /মরতে\s*চাই/u,
  /আত্মহত্যা/u,
  /বাঁচতে\s*চাই\s*না/u,
];

// Marathi (Devanagari, distinct phrasing)
const HIGH_MR = [
  /मरायचंय|मरायचं\s*आहे/u,
  /जगायचं\s*नाही/u,
];

// ----- MEDIUM SEVERITY ----------------------------------------------

const MEDIUM_EN = [
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\bnobody\s+(?:cares|would\s+miss\s+me)\b/i,
  /\bgive\s+up\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\b(?:i\s+am|i'?m)\s+(?:done|finished|exhausted|drained|empty)\b/i,
  /\beverything\s+(?:is|feels)\s+pointless\b/i,
  /\bi\s+hate\s+myself\b/i,
  /\b(?:nothing|nobody)\s+matters\b/i,
  /\bcan'?t\s+breathe\b/i,
  /\bbreaking\s+down\b/i,
  /\bnumb\s+inside\b/i,
];

const MEDIUM_HINGLISH = [
  /\bthak\s+gay[ai]\s+hu(?:n|in)?\b/i,                    // thak gaya hu / thak gayi hun
  /\bbas\s+ho\s+gaya\b/i,
  /\bkuch\s+nah?in?\s+(?:samajh|achha)\b/i,               // kuch nahi samajh
  /\bdil\s+(?:bahut|bohot|bohut)\s+(?:bhar|toot)/i,        // dil toot, dil bhar gaya
  /\bakela\s+(?:hu|hoon|feel)\b/i,
  /\bandar\s+se\s+toot\b/i,
  /\bkoi\s+matlab\s+nah?in?\b/i,
  /\bmann\s+nah?in?\s+lag/i,
  /\brona\s+aa\s+raha\b/i,
];

const MEDIUM_HI = [
  /निराशा|निराश/u,
  /बेकार\s*हूँ|बेकार\s*हूं/u,
  /थक\s*गया\s*हूँ|थक\s*गई\s*हूँ/u,
  /(?:कोई\s*नहीं\s*समझता|किसी\s*को\s*परवाह\s*नहीं)/u,
  /अकेला\s*(?:हूँ|हूं|महसूस)/u,
];

// ----- API ----------------------------------------------------------

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

  // Lowercase ONLY for Latin patterns; the unicode patterns aren't
  // case-folded. Devanagari etc. don't have case anyway.
  for (const [lang, bucket] of HIGH_BUCKETS) {
    for (const re of bucket) {
      if (re.test(text)) return { severity: 'high', matched: re.source, lang };
    }
  }
  for (const [lang, bucket] of MEDIUM_BUCKETS) {
    for (const re of bucket) {
      if (re.test(text)) return { severity: 'medium', matched: re.source, lang };
    }
  }
  return { severity: 'none' };
}

// Optional helper: a short, language-aware empathy line we can prepend
// to a Companion reply when the classifier fires high. The actual
// reply still comes from the LLM — this just guarantees the helpline
// is surfaced even if the model hedges.
export function crisisAcknowledgement(lang) {
  if (lang === 'hi') {
    return 'जो तुम महसूस कर रहे हो, वो बहुत भारी है — और तुम अकेले नहीं हो। ';
  }
  if (lang === 'hinglish') {
    return "Jo tum feel kar rahe ho, woh bahut bhaari hai — aur tum akele bilkul nahi ho. ";
  }
  if (lang === 'ta') return 'நீங்கள் தனிமையாக இல்லை. ';
  if (lang === 'bn') return 'তুমি একা নও। ';
  if (lang === 'mr') return 'तू एकटा नाहीस. ';
  return "What you're feeling is real, and you're not alone. ";
}
