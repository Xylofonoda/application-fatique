import { prisma } from "@/lib/prisma";
import { generateEmbedding, generateCoverLetter, checkOllamaHealth } from "@/lib/ai";
import { readCvText } from "@/lib/cv";
import { cosineSimilarity } from "@/lib/similarity";
import { ApplicationStatus } from "@prisma/client";
import { revalidateTag, revalidatePath } from "next/cache";
import { favouriteTag } from "@/lib/data/favourites";
import { interviewTag } from "@/lib/data/interviews";
import { applicationTag } from "@/lib/data/applications";

export interface GqlContext {
  userId: string;
}

export const resolvers = {
  Query: {
    searchJobs: async (
      _: unknown,
      { query, skillLevel = "", limit = 20 }: { query: string; skillLevel?: string; limit?: number },
      { userId }: GqlContext
    ) => {
      const text = `${query} ${skillLevel}`.trim();
      const queryEmbedding = await generateEmbedding(text);

      const allJobs = await prisma.$queryRaw<Array<{
        id: string; title: string; company: string; location: string | null;
        sourceUrl: string; source: string; salary: string | null;
        postedAt: Date | null; scrapedAt: Date;
        embedding: string | null;
      }>>`
        SELECT id, title, company, location, "sourceUrl", source::text, salary,
               "postedAt", "scrapedAt", embedding::text as embedding
        FROM "JobPosting"
        WHERE embedding IS NOT NULL
        LIMIT 500
      `;

      // Check which jobs are favourited by this user
      const favouritedIds = new Set(
        (await prisma.userFavourite.findMany({ where: { userId }, select: { jobId: true } }))
          .map((f) => f.jobId)
      );

      const parsedJobs = allJobs.map((j) => ({
        ...j,
        favourited: favouritedIds.has(j.id),
        embedding: j.embedding ? JSON.parse(j.embedding) as number[] : null,
      }));
      const jobs = parsedJobs.filter(
        (j) => j.embedding !== null && (j.embedding as number[]).length === queryEmbedding.length
      );
      return jobs
        .map((job) => ({
          ...job,
          postedAt: job.postedAt?.toISOString() ?? null,
          scrapedAt: job.scrapedAt.toISOString(),
          similarity: cosineSimilarity(queryEmbedding, job.embedding as number[]),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },

    getFavourites: async (
      _: unknown,
      __: unknown,
      { userId }: GqlContext
    ) => {
      const jobs = await prisma.jobPosting.findMany({
        where: { favouritedBy: { some: { userId } } },
        orderBy: { scrapedAt: "desc" },
      });
      return jobs.map((job) => ({
        ...job,
        favourited: true,
        postedAt: job.postedAt?.toISOString() ?? null,
        scrapedAt: job.scrapedAt.toISOString(),
      }));
    },

    getApplications: async (
      _: unknown,
      { status }: { status?: ApplicationStatus },
      { userId }: GqlContext
    ) => {
      return prisma.application.findMany({
        where: { userId, ...(status ? { status } : {}) },
        include: { job: true, coverLetter: true, interview: true },
        orderBy: { createdAt: "desc" },
      });
    },

    getApplication: async (
      _: unknown,
      { id }: { id: string },
      { userId }: GqlContext
    ) => {
      return prisma.application.findFirst({
        where: { id, userId },
        include: { job: true, coverLetter: true, interview: true },
      });
    },

    getInterviews: async (
      _: unknown,
      { month, year }: { month: number; year: number },
      { userId }: GqlContext
    ) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      return prisma.interview.findMany({
        where: {
          scheduledAt: { gte: start, lt: end },
          application: { userId },
        },
        include: { application: { include: { job: true } } },
        orderBy: { scheduledAt: "asc" },
      });
    },

    getCoverLetter: async (
      _: unknown,
      { id }: { id: string },
      { userId }: GqlContext
    ) => {
      return prisma.coverLetter.findFirst({ where: { id, userId } });
    },

    getUserProfile: async (
      _: unknown,
      __: unknown,
      { userId }: GqlContext
    ) => {
      return prisma.userProfile.findUnique({ where: { userId } });
    },

    aiHealth: async () => {
      return checkOllamaHealth();
    },
  },

  Mutation: {
    toggleFavourite: async (
      _: unknown,
      { jobId }: { jobId: string },
      { userId }: GqlContext
    ) => {
      const existing = await prisma.userFavourite.findUnique({
        where: { userId_jobId: { userId, jobId } },
      });
      if (existing) {
        await prisma.userFavourite.delete({ where: { userId_jobId: { userId, jobId } } });
      } else {
        await prisma.userFavourite.create({ data: { userId, jobId } });
      }
      const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });
      revalidateTag(favouriteTag(userId), "default");
      revalidatePath("/favourites");
      return {
        ...job,
        favourited: !existing,
        postedAt: job.postedAt?.toISOString() ?? null,
        scrapedAt: job.scrapedAt.toISOString(),
      };
    },

    updateApplicationStatus: async (
      _: unknown,
      { id, status }: { id: string; status: ApplicationStatus },
      { userId }: GqlContext
    ) => {
      return prisma.application.update({
        where: { id, userId },
        data: { status },
        include: { job: true, coverLetter: true, interview: true },
      });
    },

    scheduleInterview: async (
      _: unknown,
      {
        applicationId,
        scheduledAt,
        durationMinutes = 60,
        timezone = "UTC",
        notes,
      }: {
        applicationId: string;
        scheduledAt: string;
        durationMinutes?: number;
        timezone?: string;
        notes?: string;
      },
      { userId }: GqlContext
    ) => {
      const [, interview] = await prisma.$transaction([
        prisma.application.update({
          where: { id: applicationId, userId },
          data: { status: "INTERVIEW" },
        }),
        prisma.interview.upsert({
          where: { applicationId },
          create: {
            applicationId,
            scheduledAt: new Date(scheduledAt),
            durationMinutes,
            timezone,
            notes,
          },
          update: {
            scheduledAt: new Date(scheduledAt),
            durationMinutes,
            timezone,
            notes,
          },
        }),
      ]);
      revalidateTag(interviewTag(userId), "default");
      revalidateTag(applicationTag(userId), "default");
      revalidatePath("/interviews");
      revalidatePath("/dashboard");
      return interview;
    },

    updateInterview: async (
      _: unknown,
      {
        id,
        scheduledAt,
        durationMinutes,
        notes,
      }: {
        id: string;
        scheduledAt?: string;
        durationMinutes?: number;
        notes?: string;
      },
      { userId }: GqlContext
    ) => {
      // Verify the interview belongs to the user
      const interview = await prisma.interview.findFirst({
        where: { id, application: { userId } },
      });
      if (!interview) throw new Error("Not found");
      const updated = await prisma.interview.update({
        where: { id },
        data: {
          ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
          ...(durationMinutes !== undefined ? { durationMinutes } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });
      revalidateTag(interviewTag(userId), "default");
      revalidatePath("/interviews");
      return updated;
    },

    generateCoverLetter: async (
      _: unknown,
      { jobId, useSavedCV = true }: { jobId: string; useSavedCV?: boolean },
      { userId }: GqlContext
    ) => {
      const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });

      let cvText = "";
      if (useSavedCV) {
        cvText = await readCvText(userId).catch(() => "");
      }

      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { coverLetterLanguage: true },
      });
      const language = userProfile?.coverLetterLanguage ?? "English";

      const content = await generateCoverLetter(
        job.title,
        job.company,
        job.description,
        cvText,
        language,
      );

      const [coverLetter] = await prisma.$transaction([
        prisma.coverLetter.create({
          data: { userId, jobId, content, generatedByAI: true },
        }),
        prisma.userFavourite.upsert({
          where: { userId_jobId: { userId, jobId } },
          create: { userId, jobId },
          update: {},
        }),
      ]);
      revalidateTag(favouriteTag(userId), "default");
      revalidatePath("/favourites");
      return coverLetter;
    },

    deleteCoverLetter: async (
      _: unknown,
      { id }: { id: string },
      { userId }: GqlContext
    ) => {
      const cl = await prisma.coverLetter.findUnique({ where: { id } });
      // If it doesn't exist at all, treat as already deleted (idempotent)
      if (!cl) {
        revalidateTag(applicationTag(userId), "default");
        return true;
      }
      // Ownership check
      if (cl.userId !== userId) throw new Error("Not found");
      await prisma.application.updateMany({
        where: { coverLetterId: id, userId },
        data: { coverLetterId: null },
      });
      await prisma.coverLetter.delete({ where: { id } });
      revalidateTag(applicationTag(userId), "default");
      return true;
    },

    saveUserProfile: async (
      _: unknown,
      args: {
        name: string;
        email: string;
        phone?: string;
        linkedInUrl?: string;
        githubUrl?: string;
      },
      { userId }: GqlContext
    ) => {
      return prisma.userProfile.upsert({
        where: { userId },
        update: args,
        create: { userId, ...args },
      });
    },
  },
};
