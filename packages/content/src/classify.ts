import {
  ArticleEcosystem,
  type ArticleEcosystem as ArticleEcosystemValue,
  ArticleRiskCategory,
  type ArticleRiskCategory as ArticleRiskCategoryValue,
} from "@vibeguard/shared";

type ClassifySecurityContentInput = {
  sourceName?: string | null;
  url?: string | null;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  categories?: string[] | null;
};

type ClassificationResult = {
  ecosystem: ArticleEcosystemValue;
  riskCategory: ArticleRiskCategoryValue;
  tags: string[];
};

const ecosystemMatchers: Array<{
  ecosystem: ArticleEcosystemValue;
  patterns: RegExp[];
}> = [
  {
    ecosystem: ArticleEcosystem.NPM,
    patterns: [/\bnpm\b/i, /\bnode\.?js\b/i, /\bpackage\.json\b/i],
  },
  {
    ecosystem: ArticleEcosystem.PYPI,
    patterns: [
      /\bpypi\b/i,
      /\bpip\b/i,
      /\bpython\b/i,
      /\brequirements\.txt\b/i,
    ],
  },
  {
    ecosystem: ArticleEcosystem.MAVEN,
    patterns: [/\bmaven\b/i, /\bgradle\b/i, /\bjava\b/i],
  },
  {
    ecosystem: ArticleEcosystem.GO,
    patterns: [/\bgolang\b/i, /\bgo module\b/i, /\bgo package\b/i],
  },
  {
    ecosystem: ArticleEcosystem["CRATES-IO"],
    patterns: [/\bcrates?\.io\b/i, /\bcargo\b/i, /\brust\b/i],
  },
  {
    ecosystem: ArticleEcosystem["GITHUB-ACTIONS"],
    patterns: [/\bgithub actions?\b/i, /\bworkflow\b/i, /\baction\b/i],
  },
  {
    ecosystem: ArticleEcosystem.DOCKER,
    patterns: [/\bdocker\b/i, /\bcontainer\b/i, /\bimage\b/i],
  },
];

const riskMatchers: Array<{
  category: ArticleRiskCategoryValue;
  patterns: RegExp[];
}> = [
  {
    category: ArticleRiskCategory["MALICIOUS-PACKAGE"],
    patterns: [
      /\bmalicious package\b/i,
      /\bbackdoor\b/i,
      /\btyposquat/i,
      /\bmalware\b/i,
      /\bcrypto ?miner\b/i,
    ],
  },
  {
    category: ArticleRiskCategory["EXPLOIT-ACTIVITY"],
    patterns: [
      /\bin the wild\b/i,
      /\bknown exploited\b/i,
      /\bactively exploited\b/i,
      /\bexploit(?:ed|ing)?\b/i,
      /\bkev\b/i,
    ],
  },
  {
    category: ArticleRiskCategory["SUPPLY-CHAIN-ATTACK"],
    patterns: [
      /\bsupply[- ]chain\b/i,
      /\bdependency confusion\b/i,
      /\bmaintainer compromise\b/i,
      /\bcompromised release\b/i,
      /\bpoison(?:ed|ing)\b/i,
    ],
  },
  {
    category: ArticleRiskCategory.VULNERABILITY,
    patterns: [
      /\bcve-\d{4}-\d+\b/i,
      /\bvulnerability\b/i,
      /\bcvss\b/i,
      /\brce\b/i,
    ],
  },
  {
    category: ArticleRiskCategory["DEPENDENCY-RISK"],
    patterns: [/\bdependency risk\b/i, /\bpackage risk\b/i, /\bdependency\b/i],
  },
];

const tagMatchers: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "cve", patterns: [/\bcve-\d{4}-\d+\b/i] },
  {
    tag: "exploit",
    patterns: [/\bexploit(?:ed|ing)?\b/i, /\bknown exploited\b/i],
  },
  { tag: "malware", patterns: [/\bmalware\b/i, /\bbackdoor\b/i] },
  { tag: "typosquat", patterns: [/\btyposquat/i] },
  { tag: "dependency-confusion", patterns: [/\bdependency confusion\b/i] },
  { tag: "maintainer-compromise", patterns: [/\bmaintainer compromise\b/i] },
  { tag: "github-actions", patterns: [/\bgithub actions?\b/i] },
  { tag: "supply-chain", patterns: [/\bsupply[- ]chain\b/i] },
  { tag: "rce", patterns: [/\brce\b/i] },
];

function buildCorpus(input: ClassifySecurityContentInput) {
  return [
    input.sourceName || "",
    input.url || "",
    input.title || "",
    input.summary || "",
    input.content || "",
    ...(input.categories ?? []),
  ]
    .join("\n")
    .trim();
}

export function classifySecurityContent(
  input: ClassifySecurityContentInput,
): ClassificationResult {
  const corpus = buildCorpus(input);
  const ecosystems = ecosystemMatchers
    .filter(({ patterns }) => patterns.some((pattern) => pattern.test(corpus)))
    .map(({ ecosystem }) => ecosystem);

  const ecosystem =
    ecosystems.length === 0
      ? ArticleEcosystem.UNKNOWN
      : ecosystems.length === 1
        ? ecosystems[0]
        : ArticleEcosystem.MULTI;

  const riskCategory =
    riskMatchers.find(({ patterns }) =>
      patterns.some((pattern) => pattern.test(corpus)),
    )?.category ?? ArticleRiskCategory.UNKNOWN;

  const tags = new Set<string>();

  if (ecosystem !== ArticleEcosystem.UNKNOWN) {
    tags.add(ecosystem);
  }

  if (riskCategory !== ArticleRiskCategory.UNKNOWN) {
    tags.add(riskCategory);
  }

  for (const { tag, patterns } of tagMatchers) {
    if (patterns.some((pattern) => pattern.test(corpus))) {
      tags.add(tag);
    }
  }

  for (const category of input.categories ?? []) {
    const normalized = category.trim().toLowerCase();

    if (normalized) {
      tags.add(normalized.replace(/\s+/g, "-"));
    }
  }

  return {
    ecosystem,
    riskCategory,
    tags: Array.from(tags).slice(0, 12),
  };
}
