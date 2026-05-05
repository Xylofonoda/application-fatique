import { describe, it, expect, vi } from "vitest";

// Mock OpenAI so no real API call is made
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        category: "Fullstack",
        includedTitles: ["Fullstack developer"],
        excludedTitles: ["DevOps"],
        canonicalText: "Fullstack developer",
        antiText: "DevOps engineer",
        scrapingKeyword: "Fullstack",
      }),
    }),
  })),
}));

async function getLib() {
  const mod = await import("@/lib/queryIntent");
  return mod.classifyQueryIntent;
}

describe("classifyQueryIntent — static intent table (fast path)", () => {
  it("classifies 'react' as Frontend", async () => {
    const fn = await getLib();
    const intent = await fn("react", "Any");
    expect(intent.category).toBe("Frontend");
  });

  it("classifies 'React' (uppercase) as Frontend", async () => {
    const fn = await getLib();
    const intent = await fn("React", "Any");
    expect(intent.category).toBe("Frontend");
  });

  it("react intent includes React/Next.js in includedTitles", async () => {
    const fn = await getLib();
    const intent = await fn("react", "Any");
    const titles = intent.includedTitles.join(" ");
    expect(titles).toMatch(/React/i);
  });

  it("react intent excludes Backend in excludedTitles", async () => {
    const fn = await getLib();
    const intent = await fn("react", "Any");
    expect(intent.excludedTitles).toContain("Backend");
  });

  it("react antiText contains backend keywords for negative scoring", async () => {
    const fn = await getLib();
    const intent = await fn("react", "Any");
    expect(intent.antiText).toMatch(/backend|server|API/i);
  });

  it("classifies 'node' as Backend", async () => {
    const fn = await getLib();
    const intent = await fn("node", "Any");
    expect(intent.category).toBe("Backend");
  });

  it("classifies 'fullstack' as Fullstack", async () => {
    const fn = await getLib();
    const intent = await fn("fullstack", "Any");
    expect(intent.category).toBe("Fullstack");
  });

  it("classifies 'devops' as DevOps", async () => {
    const fn = await getLib();
    const intent = await fn("devops", "Any");
    expect(intent.category).toBe("DevOps");
  });

  it("provides a scrapingKeyword for all known categories", async () => {
    const fn = await getLib();
    for (const query of ["react", "node", "python", "fullstack", "devops", "vue"]) {
      const intent = await fn(query, "Any");
      expect(intent.scrapingKeyword).toBeTruthy();
    }
  });

  it("canonicalText is non-empty for known categories", async () => {
    const fn = await getLib();
    const intent = await fn("react", "Any");
    expect(intent.canonicalText.length).toBeGreaterThan(20);
  });

  it("unknown query falls through to GPT (mocked) and returns a valid intent", async () => {
    const fn = await getLib();
    const intent = await fn("zig-lang", "Any");
    // Our mock returns Fullstack for any GPT call
    expect(intent).toHaveProperty("category");
    expect(intent).toHaveProperty("includedTitles");
    expect(intent).toHaveProperty("excludedTitles");
    expect(intent).toHaveProperty("canonicalText");
    expect(intent).toHaveProperty("antiText");
    expect(intent).toHaveProperty("scrapingKeyword");
  });
});
