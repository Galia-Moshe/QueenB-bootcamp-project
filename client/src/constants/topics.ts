/** Parent categories for mentor help-area tags (directory filter grouping). */
export const TOPIC_CATEGORIES = {
  "Software Development": [
    "DevOps",
    "Cloud / Infrastructure",
    "Backend Engineer",
    "Mobile (iOS / Android)",
    "Full Stack",
    "Front End",
    "Embedded / Hardware",
    "Security / Cyber",
    "QA",
    "IT",
    "Solutions Engineering / Pre-Sales",
    "R&D / Research",
    "Technical Project Manager",
    "Agile / Scrum Master",
  ],
  "Data & Analysis": ["Data", "AI / Machine Learning", "BI / Business Intelligence"],
  "Product & Design": ["Product", "Design (UX/UI)", "Technical Writing"],
  "Business & Growth": [
    "Business Development (BizDev)",
    "Partnerships",
    "Marketing",
    "Growth / Acquisition",
    "Business Operations (BizOps)",
    "Sales",
    "Revenue Operations (RevOps)",
  ],
  "Operations & Support": [
    "Operations",
    "Customer Care",
    "Technical Support",
    "Customer Success",
    "Finance",
  ],
  "Soft Skills & Career": ["Community Management", "HR", "אחר"],
} as const;

export type TopicCategory = keyof typeof TOPIC_CATEGORIES;

function sortTopicsAlphabetically(topics: readonly string[]) {
  return [...topics].sort((a, b) => a.localeCompare(b, "he"));
}

/** Categories with child topics sorted alphabetically (he locale for mixed HE/EN). */
export const SORTED_TOPIC_CATEGORIES: Record<TopicCategory, string[]> = Object.fromEntries(
  (Object.entries(TOPIC_CATEGORIES) as [TopicCategory, readonly string[]][]).map(
    ([category, topics]) => [category, sortTopicsAlphabetically(topics)]
  )
) as Record<TopicCategory, string[]>;

/** Flat list derived from category order — used by registration & filters. */
export const HELP_AREAS = (
  Object.values(SORTED_TOPIC_CATEGORIES) as string[][]
).flat();

export type HelpArea = (typeof HELP_AREAS)[number];

/** Topic → parent category lookup for Autocomplete `groupBy`. */
export const TOPIC_TO_CATEGORY: Record<string, TopicCategory> = Object.fromEntries(
  (Object.entries(SORTED_TOPIC_CATEGORIES) as [TopicCategory, string[]][]).flatMap(
    ([category, topics]) => topics.map((topic) => [topic, category])
  )
) as Record<string, TopicCategory>;

/** Topics sorted by parent category, then alphabetically within each category. */
export const CATEGORIZED_TOPICS = HELP_AREAS;
