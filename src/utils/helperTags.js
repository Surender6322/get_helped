// Canonical set of helper specialization tags. Stored on user docs as
// `tags: string[]` and used both on the helper profile editor and the
// "Find a helper" filter chips.

export const HELPER_TAGS = [
  { key: 'anxiety', label: 'Anxiety' },
  { key: 'depression', label: 'Depression' },
  { key: 'exam_stress', label: 'Exam stress' },
  { key: 'work_burnout', label: 'Work / burnout' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'family', label: 'Family' },
  { key: 'lgbtq', label: 'LGBTQ+' },
  { key: 'grief', label: 'Grief & loss' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'self_esteem', label: 'Self-esteem' },
  { key: 'addiction', label: 'Addiction' },
  { key: 'crisis', label: 'Crisis support' },
];

export function tagLabel(key) {
  return HELPER_TAGS.find((t) => t.key === key)?.label || key;
}
