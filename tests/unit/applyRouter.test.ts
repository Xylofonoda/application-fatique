import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * applyRouter unit tests
 *
 * We mock applyStartupjobs so no real browser is launched.
 * We verify that:
 *  - STARTUPJOBS source routes to the startupjobs handler
 *  - Every other source returns MANUAL_REQUIRED without calling the handler
 */

// --- Mocks -------------------------------------------------------------------

const mockApplyStartupjobs = vi.fn();

vi.mock("@/lib/apply/applyStartupjobs", () => ({
  applyStartupjobs: (...args: unknown[]) => mockApplyStartupjobs(...args),
}));

// Minimal mock ApplicantProfile
const PROFILE = {
  name: "Test User",
  email: "test@example.com",
  phone: "+420 600 000 000",
  linkedInUrl: null,
  githubUrl: null,
  coverLetterText: null,
};

const JOB_URL = "https://startupjobs.cz/en/job/some-react-job-12345";

async function getApplyRouter() {
  const mod = await import("@/lib/apply/applyRouter");
  return mod.applyRouter;
}

describe("applyRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes STARTUPJOBS to applyStartupjobs", async () => {
    mockApplyStartupjobs.mockResolvedValue({ status: "APPLIED" });
    const applyRouter = await getApplyRouter();

    // We need the actual JobSource enum value
    const { JobSource } = await import("@prisma/client");
    const result = await applyRouter(JobSource.STARTUPJOBS, JOB_URL, PROFILE);

    expect(mockApplyStartupjobs).toHaveBeenCalledOnce();
    expect(mockApplyStartupjobs).toHaveBeenCalledWith(JOB_URL, PROFILE, undefined);
    expect(result.status).toBe("APPLIED");
  });

  it("passes cvBuffer to startupjobs handler", async () => {
    mockApplyStartupjobs.mockResolvedValue({ status: "APPLIED" });
    const applyRouter = await getApplyRouter();
    const { JobSource } = await import("@prisma/client");

    const cv = Buffer.from("fake-pdf-bytes");
    await applyRouter(JobSource.STARTUPJOBS, JOB_URL, PROFILE, cv);

    expect(mockApplyStartupjobs).toHaveBeenCalledWith(JOB_URL, PROFILE, cv);
  });

  it("returns MANUAL_REQUIRED for NOFLUFFJOBS without calling startupjobs handler", async () => {
    const applyRouter = await getApplyRouter();
    const { JobSource } = await import("@prisma/client");

    const result = await applyRouter(JobSource.NOFLUFFJOBS, "https://nofluffjobs.com/job/123", PROFILE);

    expect(mockApplyStartupjobs).not.toHaveBeenCalled();
    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.errorMessage).toMatch(/NOFLUFFJOBS/);
  });

  it("returns MANUAL_REQUIRED for GLASSDOOR without calling startupjobs handler", async () => {
    const applyRouter = await getApplyRouter();
    const { JobSource } = await import("@prisma/client");

    const result = await applyRouter(JobSource.GLASSDOOR, "https://glassdoor.com/job/123", PROFILE);

    expect(mockApplyStartupjobs).not.toHaveBeenCalled();
    expect(result.status).toBe("MANUAL_REQUIRED");
  });

  it("forwards FAILED status from startupjobs handler", async () => {
    mockApplyStartupjobs.mockResolvedValue({ status: "FAILED", errorMessage: "Timeout" });
    const applyRouter = await getApplyRouter();
    const { JobSource } = await import("@prisma/client");

    const result = await applyRouter(JobSource.STARTUPJOBS, JOB_URL, PROFILE);

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toBe("Timeout");
  });

  it("forwards MANUAL_REQUIRED from startupjobs handler (external ATS)", async () => {
    mockApplyStartupjobs.mockResolvedValue({
      status: "MANUAL_REQUIRED",
      errorMessage: "External ATS detected (greenhouse.io)",
    });
    const applyRouter = await getApplyRouter();
    const { JobSource } = await import("@prisma/client");

    const result = await applyRouter(JobSource.STARTUPJOBS, JOB_URL, PROFILE);

    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.errorMessage).toMatch(/greenhouse\.io/);
  });
});
