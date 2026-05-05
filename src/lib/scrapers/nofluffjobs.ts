/**
 * NoFluffJobs scraper — uses Playwright to render the HTML search page.
 *
 * Category-slug strategy: when a query maps to a known NoFluffJobs tech
 * category, we use the dedicated slug URL (e.g. /cz/jobs/react) which returns
 * far more results than the generic keyword search. Falls back to the
 * keyword-search URL for unrecognised queries.
 *
 * Pagination: 5 pages (normal) / 10 pages (deepSearch).
 */
import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob, ScraperOptions } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

const BASE = "https://nofluffjobs.com";

// ─── Category slug map ────────────────────────────────────────────────────────
// Maps normalised query keywords → NoFluffJobs /cz/jobs/<slug> paths.
// When a slug is available the result set is dramatically larger.

const NFF_CATEGORY_MAP: Record<string, string> = {
  react: "react",
  "react.js": "react",
  reactjs: "react",
  nextjs: "react",
  "next.js": "react",
  vue: "vue",
  "vue.js": "vue",
  angular: "angular",
  frontend: "frontend-developer",
  javascript: "javascript",
  typescript: "typescript",
  backend: "backend-developer",
  "node.js": "node.js",
  nodejs: "node.js",
  python: "python",
  java: "java",
  golang: "go",
  go: "go",
  php: "php",
  fullstack: "fullstack-developer",
  devops: "devops-engineer",
  mobile: "mobile-developer",
  ios: "ios-developer",
  android: "android-developer",
  flutter: "flutter",
  "react native": "react-native",
  reactnative: "react-native",
  qa: "qa-engineer",
  testing: "qa-engineer",
  data: "data-engineer",
  ml: "machine-learning",
  "machine learning": "machine-learning",
  kotlin: "kotlin",
  swift: "swift",
  ruby: "ruby",
  scala: "scala",
  rust: "rust",
  csharp: "c-sharp",
  dotnet: ".net-developer",
};

function resolveNffUrl(query: string, scrapingKeyword: string, page: number): string {
  const lookupKey = (scrapingKeyword || query).toLowerCase().trim().replace(/[.\s-]+/g, "");
  const altKey = (scrapingKeyword || query).toLowerCase().trim();
  const slug = NFF_CATEGORY_MAP[lookupKey] ?? NFF_CATEGORY_MAP[altKey];

  const base = slug
    ? `${BASE}/cz/jobs/${slug}?criteria=remote` // category URL — much richer results
    : `${BASE}/cz/${encodeURIComponent(query)}?remote=true`; // keyword fallback

  return page > 1 ? `${base}&page=${page}` : base;
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

export async function scrapeNoFluffJobs(
  query: string,
  skillLevel: string,
  deepSearch = false,
  _city = "",
  opts?: ScraperOptions,
): Promise<ScrapedJob[]> {
  const MAX_PAGES = deepSearch ? 10 : 2;
  const jobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  const scrapingKeyword = opts?.scrapingKeyword ?? query;
  const intent = opts?.intent;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const searchUrl = resolveNffUrl(query, scrapingKeyword, page);

    let result: { text: string; links: Array<{ text: string; url: string }> };
    try {
      result = await pwFetch(searchUrl, "a[href*='/cz/job/']");
    } catch {
      break;
    }

    const { text: pageText, links } = result;
    if (!pageText || pageText.length < 100) break;

    // Filter to only /cz/job/ links and dedupe across pages
    const jobLinks = links
      .filter((l) => l.url.includes("/cz/job/"))
      .filter((l) => {
        if (seenUrls.has(l.url)) return false;
        seenUrls.add(l.url);
        return true;
      });

    if (jobLinks.length === 0) break;

    // If page N has entirely duplicate links, NFJ has no more pages
    if (page > 1) {
      const existingUrls = new Set(jobs.map((j) => j.sourceUrl));
      const allSeen = jobLinks.every((l) => existingUrls.has(l.url));
      if (allSeen) break;
    }

    // AI filtering — pass intent for precision domain filtering
    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, jobLinks, undefined, intent);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 6, async ({ title, url }) => {
      try {
        const { text } = await pwFetch(url, "[class*='description'], [class*='job-desc'], main");
        const extracted = await extractJobFromText(text, { url, title, company: "", location: "Remote" });
        if (!extracted.title) return null;

        return {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location || "Remote",
          description: extracted.description,
          sourceUrl: url,
          source: "NOFLUFFJOBS" as const,
          salary: extracted.salary || undefined,
          workType: "Remote",
        };
      } catch {
        return null;
      }
    });

    jobs.push(...batchedJobs);

    // Deep-search freshness check: stop early if all jobs on this page are recent
    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const pageUrls = relevant.map((j) => j.url);
      const freshCount = await prisma.jobPosting.count({
        where: {
          sourceUrl: { in: pageUrls },
          scrapedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (freshCount === pageUrls.length) break;
    }

    if (page < MAX_PAGES) await new Promise((r) => setTimeout(r, 800));
  }

  return jobs;
}

