import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { assertText, requireRole } from "./lib/auth";
import { coreMentorTopics, isNonAnswer, maxDiscoveryQuestions, mentorQuestion, mentorQuestionTopic, mentorSource, requestsSensitiveInformation } from "./lib/mentor";

const newChatTitle = "New chat";
export const mentorBriefTopic = mentorQuestionTopic;
const mentorBriefSnapshot = v.object({
  goal: v.union(v.string(), v.null()), audience: v.union(v.string(), v.null()),
  problem: v.union(v.string(), v.null()), constraints: v.union(v.string(), v.null()),
  deliverable: v.union(v.string(), v.null()), successCriterion: v.union(v.string(), v.null()),
  openQuestion: v.union(v.string(), v.null()), openQuestionTopic: v.union(mentorBriefTopic, v.null()),
  questionsAsked: v.number(), askedTopics: v.array(mentorBriefTopic),
  stage: v.union(v.literal("discovery"), v.literal("guidance")), summary: v.string(),
});
type BriefTopic = "goal" | "audience" | "problem" | "constraints" | "deliverable" | "successCriterion";

function titleFromBody(body: string) {
  const compact = body.trim().replace(/\s+/g, " ");
  return compact.length <= 48 ? compact : `${compact.slice(0, 47).trimEnd()}…`;
}

function legacyTitle(messages: Doc<"mentorMessages">[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  return firstUserMessage ? titleFromBody(firstUserMessage.body) : "Previous chat";
}

async function migrateLegacyConversation(ctx: MutationCtx, studentProfileId: Id<"profiles">) {
  const legacyMessages = (await ctx.db.query("mentorMessages")
    .withIndex("by_student", (q) => q.eq("studentProfileId", studentProfileId))
    .take(500)).filter((message) => !message.conversationId);
  const legacyThread = await ctx.db.query("mentorThreads")
    .withIndex("by_student", (q) => q.eq("studentProfileId", studentProfileId))
    .first();
  if (!legacyMessages.length && !legacyThread) return null;
  const fields = legacyConversationFields(legacyMessages, legacyThread);
  const conversationId = await ctx.db.insert("mentorConversations", { studentProfileId, ...fields });
  for (const message of legacyMessages) await ctx.db.patch(message._id, { conversationId });
  return conversationId;
}

function legacyConversationFields(legacyMessages: Doc<"mentorMessages">[], legacyThread: Doc<"mentorThreads"> | null) {
  const createdAt = legacyMessages[0]?.createdAt ?? legacyThread?.createdAt ?? Date.now();
  const updatedAt = legacyMessages.at(-1)?.createdAt ?? legacyThread?.updatedAt ?? createdAt;
  return {
    title: legacyTitle(legacyMessages),
    agentThreadId: legacyThread?.agentThreadId,
    createdAt,
    updatedAt,
  };
}

async function newestConversation(ctx: MutationCtx, studentProfileId: Id<"profiles">) {
  return await ctx.db.query("mentorConversations")
    .withIndex("by_student_updated", (q) => q.eq("studentProfileId", studentProfileId))
    .order("desc")
    .first();
}

function capabilityQuestion(body: string) {
  return /\b(what can (you|u) do|how can (you|u) help|who are you)\b/i.test(body);
}

function briefSummary(brief: Doc<"mentorBriefs">) {
  const parts = [
    brief.goal ? `Goal: ${brief.goal}` : null,
    brief.audience ? `Audience: ${brief.audience}` : null,
    brief.problem ? `Current problem: ${brief.problem}` : null,
    brief.constraints ? `Constraints: ${brief.constraints}` : null,
    brief.deliverable ? `Intended output: ${brief.deliverable}` : null,
    brief.successCriterion ? `Success: ${brief.successCriterion}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : "No project details captured yet.";
}

function projectFactsSnapshot(brief: Doc<"mentorBriefs">) {
  return {
    goal: brief.goal ?? null, audience: brief.audience ?? null, problem: brief.problem ?? null,
    constraints: brief.constraints ?? null, deliverable: brief.deliverable ?? null,
    successCriterion: brief.successCriterion ?? null,
  };
}

function discoverySnapshot(brief: Doc<"mentorBriefs">) {
  return {
    openQuestion: brief.openQuestion ?? null, openQuestionTopic: brief.openQuestionTopic ?? null,
    questionsAsked: brief.questionsAsked ?? 0, askedTopics: brief.askedTopics ?? [],
  };
}

function briefSnapshot(brief: Doc<"mentorBriefs">) {
  return {
    ...projectFactsSnapshot(brief), ...discoverySnapshot(brief), stage: brief.stage, summary: brief.summary,
  };
}

function enoughForGuidance(brief: Doc<"mentorBriefs">) {
  return Boolean(brief.goal && brief.audience && brief.problem);
}

function topicHasAnswer(brief: Doc<"mentorBriefs">, topic: BriefTopic) {
  return Boolean(brief[topic]);
}

function discoveryComplete(brief: Doc<"mentorBriefs">) {
  const attempted = new Set(brief.askedTopics ?? []);
  return enoughForGuidance(brief)
    || coreMentorTopics.every((topic) => topicHasAnswer(brief, topic) || attempted.has(topic))
    || (brief.questionsAsked ?? 0) >= maxDiscoveryQuestions;
}

async function ensureBrief(ctx: MutationCtx, conversationId: Id<"mentorConversations">, studentProfileId: Id<"profiles">) {
  const existing = await ctx.db.query("mentorBriefs").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).unique();
  if (existing) return existing;
  const now = Date.now();
  const briefId = await ctx.db.insert("mentorBriefs", {
    conversationId, studentProfileId, summary: "No project details captured yet.", stage: "discovery", createdAt: now, updatedAt: now,
  });
  const created = await ctx.db.get("mentorBriefs", briefId);
  if (!created) throw new Error("Unable to create the mentor brief.");
  return created;
}

function answerPatch(topic: BriefTopic, body: string) {
  if (topic === "goal") return { goal: body };
  if (topic === "audience") return { audience: body };
  if (topic === "problem") return { problem: body };
  if (topic === "constraints") return { constraints: body };
  if (topic === "deliverable") return { deliverable: body };
  return { successCriterion: body };
}

function initialFacts(body: string) {
  const compact = body.trim().replace(/\s+/g, " ");
  const describedAudience = compact.match(/\bfor\s+(.{2,120}?)(?=\s+(?:who|that)\b)/i)?.[1]?.trim();
  const namedAudience = compact.match(/\bfor\s+((?=[^,.]{2,120}\b(?:students|users|clients|customers|designers|teachers|creators|developers|managers|teams|parents|children|adults|people)\b)[^,.]{2,120})(?=[,.]|$)/i)?.[1]?.trim();
  const audience = describedAudience ?? namedAudience;
  const problem = compact.match(/\b(?:who|that)\s+([^.!?]{3,180})/i)?.[1]?.trim();
  return {
    goal: body,
    ...(audience ? { audience } : {}),
    ...(problem ? { problem } : {}),
  };
}

async function ingestStudentTurn(ctx: MutationCtx, brief: Doc<"mentorBriefs">, body: string) {
  const usableAnswer = !capabilityQuestion(body) && !isNonAnswer(body) && !requestsSensitiveInformation(body);
  const captured = brief.openQuestionTopic && usableAnswer
    ? answerPatch(brief.openQuestionTopic, body.replace(/^actually[,\s]*/i, "").trim())
    : (!brief.goal && usableAnswer ? initialFacts(body) : {});
  const next = {
    ...brief, ...captured, openQuestion: undefined, openQuestionTopic: undefined,
  } as Doc<"mentorBriefs">;
  const stage = discoveryComplete(next) ? "guidance" as const : "discovery" as const;
  await ctx.db.patch(brief._id, { ...captured, openQuestion: undefined, openQuestionTopic: undefined, stage, summary: briefSummary(next), updatedAt: Date.now() });
  const updated = await ctx.db.get("mentorBriefs", brief._id);
  if (!updated) throw new Error("Unable to update the mentor brief.");
  return updated;
}

export const ensureConversation = mutation({
  args: {},
  returns: v.id("mentorConversations"),
  handler: async (ctx) => {
    const student = await requireRole(ctx, "student");
    const existing = await newestConversation(ctx, student._id);
    if (existing) return existing._id;
    const migrated = await migrateLegacyConversation(ctx, student._id);
    if (migrated) return migrated;
    const now = Date.now();
    return await ctx.db.insert("mentorConversations", { studentProfileId: student._id, title: newChatTitle, createdAt: now, updatedAt: now });
  },
});

export const createConversation = mutation({
  args: {},
  returns: v.id("mentorConversations"),
  handler: async (ctx) => {
    const student = await requireRole(ctx, "student");
    const existing = await newestConversation(ctx, student._id);
    if (!existing) await migrateLegacyConversation(ctx, student._id);
    const now = Date.now();
    return await ctx.db.insert("mentorConversations", { studentProfileId: student._id, title: newChatTitle, createdAt: now, updatedAt: now });
  },
});

export const prepareTurn = internalMutation({
  args: { body: v.string(), turnKey: v.string(), conversationId: v.optional(v.id("mentorConversations")) },
  returns: v.union(
    v.object({ kind: v.literal("duplicate") }),
    v.object({
      kind: v.literal("ready"),
      body: v.string(),
      studentProfileId: v.id("profiles"),
      conversationId: v.id("mentorConversations"),
      agentThreadId: v.union(v.string(), v.null()),
      brief: mentorBriefSnapshot,
    }),
  ),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const turnKey = assertText(args.turnKey, "Mentor turn key", 120);
    const existingMessage = await ctx.db.query("mentorMessages")
      .withIndex("by_student_turn_key", (q) => q.eq("studentProfileId", student._id).eq("turnKey", turnKey))
      .first();
    if (existingMessage) return { kind: "duplicate" as const };
    let conversation = args.conversationId ? await ctx.db.get("mentorConversations", args.conversationId) : await newestConversation(ctx, student._id);
    if (conversation && conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    if (!conversation) {
      const migrated = await migrateLegacyConversation(ctx, student._id);
      conversation = migrated ? await ctx.db.get("mentorConversations", migrated) : null;
    }
    if (!conversation) {
      const now = Date.now();
      const conversationId = await ctx.db.insert("mentorConversations", { studentProfileId: student._id, title: newChatTitle, createdAt: now, updatedAt: now });
      conversation = await ctx.db.get("mentorConversations", conversationId);
    }
    if (!conversation) throw new Error("Unable to create the mentor conversation.");
    const body = assertText(args.body, "Mentor question", 2000);
    const brief = await ingestStudentTurn(ctx, await ensureBrief(ctx, conversation._id, student._id), body);
    return {
      kind: "ready" as const,
      body,
      studentProfileId: student._id,
      conversationId: conversation._id,
      agentThreadId: conversation.agentThreadId ?? null,
      brief: briefSnapshot(brief),
    };
  },
});

export const readBrief = internalQuery({
  args: { conversationId: v.id("mentorConversations") },
  returns: mentorBriefSnapshot,
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    const brief = await ctx.db.query("mentorBriefs").withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id)).unique();
    if (!brief) throw new Error("Mentor brief not found.");
    return briefSnapshot(brief);
  },
});

export const updateBrief = internalMutation({
  args: {
    conversationId: v.id("mentorConversations"), goal: v.optional(v.string()), audience: v.optional(v.string()),
    problem: v.optional(v.string()), constraints: v.optional(v.string()), deliverable: v.optional(v.string()),
    successCriterion: v.optional(v.string()),
  },
  returns: mentorBriefSnapshot,
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    const brief = await ensureBrief(ctx, conversation._id, student._id);
    const { conversationId: _conversationId, ...rawPatch } = args;
    const patch = Object.fromEntries(Object.entries(rawPatch).filter(([, value]) => typeof value === "string" && value.trim())) as Partial<Doc<"mentorBriefs">>;
    const next = { ...brief, ...patch } as Doc<"mentorBriefs">;
    const stage = discoveryComplete(next) ? "guidance" as const : "discovery" as const;
    await ctx.db.patch(brief._id, { ...patch, stage, summary: briefSummary(next), updatedAt: Date.now() });
    const updated = await ctx.db.get("mentorBriefs", brief._id);
    if (!updated) throw new Error("Unable to update the mentor brief.");
    return briefSnapshot(updated);
  },
});

export const recordQuestion = internalMutation({
  args: { conversationId: v.id("mentorConversations"), topic: mentorBriefTopic, question: v.string() },
  returns: mentorBriefSnapshot,
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    const brief = await ensureBrief(ctx, conversation._id, student._id);
    const question = assertText(args.question, "Mentor question", 500);
    const askedTopics = brief.askedTopics ?? [];
    if (discoveryComplete(brief) || (brief.questionsAsked ?? 0) >= maxDiscoveryQuestions || askedTopics.includes(args.topic)) return briefSnapshot(brief);
    await ctx.db.patch(brief._id, {
      openQuestion: question,
      openQuestionTopic: args.topic,
      questionsAsked: (brief.questionsAsked ?? 0) + 1,
      askedTopics: [...askedTopics, args.topic],
      stage: "discovery",
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("mentorBriefs", brief._id);
    if (!updated) throw new Error("Unable to update the mentor brief.");
    return briefSnapshot(updated);
  },
});

export const claimThread = internalMutation({
  args: { studentProfileId: v.id("profiles"), conversationId: v.id("mentorConversations"), agentThreadId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== args.studentProfileId) throw new Error("Mentor conversation not found.");
    if (conversation.agentThreadId) return conversation.agentThreadId;
    await ctx.db.patch(conversation._id, { agentThreadId: args.agentThreadId, updatedAt: Date.now() });
    return args.agentThreadId;
  },
});

export const commitTurn = internalMutation({
  args: {
    conversationId: v.id("mentorConversations"),
    body: v.string(),
    turnKey: v.string(),
    response: v.string(),
    source: mentorSource,
    model: v.string(),
    question: v.optional(mentorQuestion),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    const existing = await ctx.db.query("mentorMessages")
      .withIndex("by_student_turn_key", (q) => q.eq("studentProfileId", student._id).eq("turnKey", args.turnKey))
      .first();
    if (existing) return null;
    const now = Date.now();
    const turnId = `${student._id}:${args.turnKey}`;
    await ctx.db.insert("mentorMessages", {
      studentProfileId: student._id, conversationId: conversation._id, turnId, role: "user", sequence: 0,
      body: args.body, turnKey: args.turnKey, createdAt: now,
    });
    await ctx.db.insert("mentorMessages", {
      studentProfileId: student._id, conversationId: conversation._id, turnId, role: "mentor", sequence: 1,
      body: args.response, turnKey: args.turnKey, question: args.question, source: args.source, model: args.model,
      ruleVersion: args.source === "simulated" ? "deterministic-socratic-v1" : undefined,
      isSimulated: args.source === "simulated" ? true : undefined,
      createdAt: now + 1,
    });
    await ctx.db.patch(conversation._id, { title: conversation.title === newChatTitle ? titleFromBody(args.body) : conversation.title, updatedAt: now + 1 });
    return null;
  },
});

export const prepareDeleteConversation = internalQuery({
  args: { conversationId: v.id("mentorConversations") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    return conversation.agentThreadId ?? null;
  },
});

export const deleteConversationRecords = internalMutation({
  args: { conversationId: v.id("mentorConversations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const conversation = await ctx.db.get("mentorConversations", args.conversationId);
    if (!conversation || conversation.studentProfileId !== student._id) throw new Error("Mentor conversation not found.");
    const messages = await ctx.db.query("mentorMessages")
      .withIndex("by_conversation_and_createdAt", (q) => q.eq("conversationId", conversation._id))
      .take(100);
    for (const message of messages) await ctx.db.delete(message._id);
    if (messages.length === 100) return false;
    const brief = await ctx.db.query("mentorBriefs")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .unique();
    if (brief) await ctx.db.delete(brief._id);
    await ctx.db.delete(conversation._id);
    return true;
  },
});

export const prepareClear = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const student = await requireRole(ctx, "student");
    const conversations = await ctx.db.query("mentorConversations")
      .withIndex("by_student_updated", (q) => q.eq("studentProfileId", student._id))
      .take(100);
    const legacyThread = await ctx.db.query("mentorThreads").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).first();
    return [...conversations.flatMap((conversation) => conversation.agentThreadId ? [conversation.agentThreadId] : []), ...(legacyThread ? [legacyThread.agentThreadId] : [])];
  },
});

export const clearRecords = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const student = await requireRole(ctx, "student");
    const messages = await ctx.db.query("mentorMessages").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).take(500);
    for (const message of messages) await ctx.db.delete(message._id);
    const briefs = await ctx.db.query("mentorBriefs").withIndex("by_student_updated", (q) => q.eq("studentProfileId", student._id)).take(100);
    for (const brief of briefs) await ctx.db.delete(brief._id);
    const conversations = await ctx.db.query("mentorConversations").withIndex("by_student_updated", (q) => q.eq("studentProfileId", student._id)).take(100);
    for (const conversation of conversations) await ctx.db.delete(conversation._id);
    const thread = await ctx.db.query("mentorThreads").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).first();
    if (thread) await ctx.db.delete(thread._id);
    return null;
  },
});
