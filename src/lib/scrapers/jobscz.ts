/**
 * Jobs.cz scraper — Czech's largest job board (by Alma Career).
 * URL pattern: https://www.jobs.cz/prace/?q[]=react
 * Uses Playwright because the site is a React SPA.
 */
import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

export async function scrapeJobsCz(
  query: string,
  skillLevel: string,
  deepSearch = false,
  city = "",
): Promise<ScrapedJob[]> {
  const MAX_PAGES = deepSearch ? 3 : 1;
  const jobs: ScrapedJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams();
    params.set("q", query);
    if (city) params.set("locality[city]", city);
    if (page > 1) params.set("page", String(page));

    const searchUrl = `https://www.jobs.cz/prace/?${params.toString()}`;
    let result: { text: string; links: Array<{ text: string; url: string }> };

    try {
      result = await pwFetch(searchUrl, "[data-jobad-id], [class*='SearchResultCard'], a[href*='/rpd/']");
    } catch {
      break;
    }

    const { text: pageText, links } = result;

    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, links);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 7, async ({ title, url }) => {
      try {
        const { text } = await pwFetch(url);
        const extracted = await extractJobFromText(text, { url, title, company: "", location: city || "Czech Republic" });
        if (!extracted.title) return null;

        return {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location,
          description: extracted.description,
          sourceUrl: url,
          source: "JOBSCZ" as const,
          salary: extracted.salary || undefined,
          workType: extracted.workType || undefined,
        };
      } catch {
        return null;
      }
    });

    jobs.push(...batchedJobs);

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const pageUrls = relevant.map((j) => j.url);
      const freshCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: pageUrls }, scrapedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (freshCount === pageUrls.length) break;
    }
  }

  return jobs;
}
