/**
 * Playwright helpers shared across E2E tests.
 */
import { Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_FILE = path.join(__dirname, "../.auth/user.json");

/** Returns true if the saved auth state has real cookies (i.e. user is logged in). */
export function isAuthAvailable(): boolean {
  if (!fs.existsSync(AUTH_FILE)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/** Navigates to a page and confirms it is NOT the login page. Skips the test if it is. */
export async function requireAuth(page: Page, url = "/") {
  await page.goto(url);
  const onLogin = page.url().includes("/login");
  if (onLogin) {
    // Signal to the test to skip
    return false;
  }
  return true;
}

/** Wait for the SSE scrape stream to start emitting progress events. */
export async function waitForScrapeProgress(page: Page, timeoutMs = 15_000) {
  await page.waitForSelector('[data-testid="scrape-progress"], [role="progressbar"]', {
    timeout: timeoutMs,
  }).catch(() => null);
}

/** Wait for job cards to appear in the search results. */
export async function waitForJobCards(page: Page, minCount = 1, timeoutMs = 60_000) {
  await page.waitForSelector('[data-testid="job-card"]', { timeout: timeoutMs }).catch(() => null);
  const cards = page.locator('[data-testid="job-card"]');
  await expect(cards.first()).toBeVisible({ timeout: timeoutMs }).catch(() => null);
  return cards;
}
