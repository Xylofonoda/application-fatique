/**
 * Auth setup: logs in as the test user (test@test.com / testtest) using
 * the Credentials provider, then saves browser state for all E2E tests.
 *
 * Prerequisites:
 *   npx tsx prisma/seed-test-user.ts   ← creates the test user in the DB
 */
import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  // Ensure auth dir exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  // Reuse cached state if it has real cookies and is less than 1 hour old
  if (fs.existsSync(AUTH_FILE)) {
    const stat = fs.statSync(AUTH_FILE);
    const ageMs = Date.now() - stat.mtimeMs;
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    const hasRealCookies = Array.isArray(state.cookies) && state.cookies.length > 0;
    if (ageMs < 60 * 60 * 1000 && hasRealCookies) {
      console.log("Reusing cached auth state.");
      return;
    }
    fs.unlinkSync(AUTH_FILE);
  }

  // Navigate to the login page
  await page.goto("/login");

  // Fill in the credentials form (test user seeded by prisma/seed-test-user.ts)
  await page.getByLabel("Email").fill("test@test.com");
  await page.getByLabel("Password").fill("testtest");
  await page.getByRole("button", { name: /^Sign in$/i }).click();

  // Wait until we land on a non-login page
  await page.waitForURL(
    (url) => url.hostname === "localhost" && !url.pathname.startsWith("/login"),
    { timeout: 15000 }
  );

  await page.waitForLoadState("networkidle");

  // Save the authenticated cookies for all subsequent tests
  await page.context().storageState({ path: AUTH_FILE });
  console.log("✓ Auth state saved (credentials login).");
});

