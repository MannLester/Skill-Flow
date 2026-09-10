"use node";

import { Agent, createThread, createTool, saveMessage } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs } from "ai";
import type { ToolSet } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, env, type ActionCtx } from "./_generated/server";
import { containsQuestion, isFactSupportedByMessage, maxDiscoveryQuestions, mentorOutputViolation, mentorSource } from "./lib/mentor";

const defaultModel = "muse-spark-1.2-contributor-free";
const instructions = `You are SkillFlow's project mentor for student designers. Work like a thoughtful Socratic mentor, not a grader or questionnaire.

Read the conversation and the current project brief before replying. Treat only the student's messages and the stored brief as project facts. Never invent research, user feedback, requirements, constraints, visual observations, or personal details. Label an inference as a working assumption. If the student's latest message adds or corrects a concrete fact, use updateProjectBrief and copy the supporting words exactly from that message. If one missing or conflicting detail prevents useful advice, use askStudent and ask exactly one focused question. Give two to four concrete, mutually exclusive answer choices and mark the choice you think is best as recommended. The student can still write a different answer. Do not ask for information the student already gave, and do not force every brief field to be filled. Once you understand the goal, the intended audience, and the real problem, state your working understanding in plain language and give a concrete recommendation. When the brief says the stage is guidance, do not ask another question unless the student explicitly asks you to clarify something.

Keep the exchange natural. No generic intake checklists, canned encouragement, repeated questions, corporate language, or em dashes. Use a period, comma, colon, or parentheses instead. Prefer one specific observation and one useful next move. You may challenge a weak assumption, but explain why. Answer simple capability questions directly.

Never request personal, confidential, payment, identity, or client information. Do not guarantee quality or employment, claim to inspect an image that was not provided, grade the student, or replace professional advice.`;

type Brief = {
  goal: string | null; audience: string | null; problem: string | null; constraints: string | null;
  deliverable: string | null; successCriterion: string | null; openQuestion: string | null;
  openQuestionTopic: "goal" | "audience" | "problem" | "constraints" | "deliverable" | "successCriterion" | null;
  questionsAsked: number; askedTopics: QuestionTopic[]; stage: "discovery" | "guidance"; summary: string;
};
type QuestionTopic = "goal" | "audience" | "problem" | "constraints" | "deliverable" | "successCriterion";
type QuestionOption = { label: string; description?: string; recommended: boolean };
type Question = { topic: QuestionTopic; text: string; options: QuestionOption[] };
type MentorReply = { response: string; source: "opencode_zen"; model: string; question: Question | null };
type PreparedTurn = {
  kind: "ready"; body: string; studentProfileId: Id<"profiles">;
  conversationId: Id<"mentorConversations">; agentThreadId: string | null; brief: Brief;
};

function cleanMentorVoice(text: string) {
  return text
    .replace(/\s*—\s*like\s+/gi, ", such as ")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1");
}

const askStudentInput = z.object({
  topic: z.enum(["goal", "audience", "problem", "constraints", "deliverable", "successCriterion"]),
  question: z.string(),
  whyItMatters: z.string(),
  options: z.array(z.object({ label: z.string(), description: z.string().optional(), recommended: z.boolean() })).min(2).max(4),
});

function cleanQuestion(input: z.infer<typeof askStudentInput>): Question {
  const preferred = Math.max(0, input.options.findIndex((option) => option.recommended));
  return {
    topic: input.topic,
    text: cleanMentorVoice(input.question),
    options: input.options.map((option, index) => ({
      label: cleanMentorVoice(option.label),
      description: option.description ? cleanMentorVoice(option.description) : undefined,
      recommended: index === preferred,
    })),
  };
}

function questionFromToolCalls(toolCalls: readonly { toolName: string; input: unknown }[]): Question | null {
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    if (toolCalls[index].toolName !== "askStudent") continue;
    const parsed = askStudentInput.safeParse(toolCalls[index].input);
    if (parsed.success) return cleanQuestion(parsed.data);
  }
  return null;
}

function configuredModel() {
  return env.OPENCODE_ZEN_MODEL?.trim()
    || env.OPENCODE_ZEN_CHAT_MODEL?.trim()
    || defaultModel;
}

function mentorTools(conversationId: Id<"mentorConversations">, latestStudentBody: string, allowQuestions: boolean): ToolSet {
  return {
    updateProjectBrief: createTool({
      description: "Save a new or corrected project fact only by copying its exact supporting words from the student's latest message. Omit unsupported fields.",
      inputSchema: z.object({
        goal: z.string().min(1).max(500).optional(), audience: z.string().min(1).max(500).optional(),
        problem: z.string().min(1).max(500).optional(), constraints: z.string().min(1).max(500).optional(),
        deliverable: z.string().min(1).max(500).optional(), successCriterion: z.string().min(1).max(500).optional(),
      }),
      execute: async (ctx, facts): Promise<{ accepted: boolean; instruction: string; brief: Brief }> => {
        const supported = Object.fromEntries(Object.entries(facts)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && isFactSupportedByMessage(latestStudentBody, entry[1])));
        if (!Object.keys(supported).length) {
          const current: Brief = await ctx.runQuery(internal.mentor.readBrief, { conversationId });
          return { accepted: false, instruction: "No fact was saved because its exact wording was not in the student's latest message.", brief: current };
        }
        const updated: Brief = await ctx.runMutation(internal.mentor.updateBrief, { conversationId, ...supported });
        return { accepted: true, instruction: "The supported facts were saved. Continue using only the student's stated details.", brief: updated };
      },
    }),
    ...(allowQuestions ? { askStudent: createTool({
      description: "Ask one blocking question with two to four short, mutually exclusive answer choices. Mark exactly one useful default as recommended. The interface also lets the student write another answer.",
      inputSchema: askStudentInput,
      execute: async (ctx, input): Promise<{ accepted: boolean; instruction: string }> => {
        const unsafe = mentorOutputViolation([input.question, ...input.options.flatMap((option) => [option.label, option.description ?? ""])].join(" "));
        if (unsafe) return { accepted: false, instruction: "Do not ask this. Give safe, grounded guidance instead." };
        const updated: Brief = await ctx.runMutation(internal.mentor.recordQuestion, { conversationId, topic: input.topic, question: input.question });
        const accepted = updated.openQuestionTopic === input.topic && Boolean(updated.openQuestion);
        return { accepted, instruction: accepted ? "Ask this question plainly, without adding another question or a checklist." : "Do not ask another question. Give the best grounded guidance available." };
      },
    }) } : {}),
  };
}

function createMentorAgent(apiKey: string, model: string, conversationId?: Id<"mentorConversations">, brief?: Brief, latestStudentBody?: string): Agent<object, ToolSet> {
  const zen = createOpenAI({
    name: "opencode-zen",
    baseURL: "https://opencode.ai/zen/v1",
    apiKey,
  });
  const briefContext = brief ? `\n\nCurrent project brief stored by SkillFlow:\n${brief.summary}\nOpen question: ${brief.openQuestion ?? "none"}` : "";
  return new Agent(components.agent, {
    name: "SkillFlow AI Project Mentor",
    languageModel: zen.responses(model),
    instructions: `${instructions}${briefContext}`,
    tools: conversationId && brief && latestStudentBody
      ? mentorTools(conversationId, latestStudentBody, brief.stage === "discovery" && brief.questionsAsked < maxDiscoveryQuestions)
      : undefined,
    stopWhen: stepCountIs(4),
  });
}

async function ensureAgentThread(ctx: ActionCtx, prepared: PreparedTurn) {
  if (prepared.agentThreadId) return prepared.agentThreadId;
  const created = await createThread(ctx, components.agent, {
    userId: prepared.studentProfileId,
    title: "AI Project Mentor",
  });
  return await ctx.runMutation(internal.mentor.claimThread, {
    studentProfileId: prepared.studentProfileId,
    conversationId: prepared.conversationId,
    agentThreadId: created,
  });
}

function recordedQuestion(question: Question | null, brief: Brief) {
  return Boolean(question && brief.stage === "discovery" && brief.openQuestionTopic === question.topic);
}

const withheldReplyMessage = "The mentor withheld an unsafe reply. Try rephrasing your message.";

function replyViolation(generated: string, question: Question | null, acceptedQuestion: boolean): string | null {
  const violation = mentorOutputViolation(generated);
  if (violation) return violation;
  if (question && !acceptedQuestion) return "unaccepted question";
  if (containsQuestion(generated) && !acceptedQuestion) return "unaccepted question";
  if ((generated.match(/\?/g)?.length ?? 0) > 1) return "too many questions";
  return null;
}

function assertReplyAllowed(generated: string, question: Question | null, acceptedQuestion: boolean) {
  if (replyViolation(generated, question, acceptedQuestion)) throw new Error(withheldReplyMessage);
}

function finalizeGeneratedReply(generated: string, question: Question | null, brief: Brief, model: string): MentorReply {
  const acceptedQuestion = recordedQuestion(question, brief);
  assertReplyAllowed(generated, question, acceptedQuestion);
  return { response: generated, source: "opencode_zen", model, question: question && acceptedQuestion ? question : null };
}

async function generateMentorReply(ctx: ActionCtx, prepared: PreparedTurn, threadId: string, promptMessageId: string): Promise<MentorReply> {
  const apiKey = env.OPENCODE_ZEN_API_KEY?.trim();
  const model = configuredModel();
  if (!apiKey) throw new Error("The AI mentor is not set up yet. Please try again later.");
  try {
    const result = await createMentorAgent(apiKey, model, prepared.conversationId, prepared.brief, prepared.body).generateText(
      ctx,
      { threadId, userId: prepared.studentProfileId },
      { promptMessageId, maxOutputTokens: 2_000, abortSignal: AbortSignal.timeout(12_000) },
    );
    const generated = cleanMentorVoice(result.text.trim());
    if (!generated) {
      const tools = result.toolCalls.map((call) => call.toolName).join(", ") || "none";
      throw new Error(`Zen returned no text (finish: ${result.finishReason}; tools: ${tools}; steps: ${result.steps.length}).`);
    }
    const currentBrief: Brief = await ctx.runQuery(internal.mentor.readBrief, { conversationId: prepared.conversationId });
    const question = questionFromToolCalls(result.toolCalls);
    return finalizeGeneratedReply(generated, question, currentBrief, model);
  } catch (error) {
    if (error instanceof Error && error.message === withheldReplyMessage) throw error;
    const reason = error instanceof Error ? error.message : "Unknown provider error";
    console.warn(`OpenCode Zen mentor request failed. ${reason}`);
    throw new Error("The AI mentor is unavailable right now. Your message was not sent, so you can try again.");
  }
}

export const sendMentorMessage = action({
  args: { body: v.string(), turnKey: v.string(), conversationId: v.optional(v.id("mentorConversations")) },
  returns: v.object({ source: mentorSource, model: v.string() }),
  handler: async (ctx, args): Promise<{ source: "simulated" | "opencode_zen"; model: string }> => {
    const prepared = await ctx.runMutation(internal.mentor.prepareTurn, args);
    if (prepared.kind === "duplicate") return { source: "opencode_zen" as const, model: configuredModel() };
    const threadId = await ensureAgentThread(ctx, prepared);
    const prompt = await saveMessage(ctx, components.agent, {
      threadId, userId: prepared.studentProfileId, prompt: prepared.body,
    });
    const reply: MentorReply = await generateMentorReply(ctx, prepared, threadId, prompt.messageId);
    await ctx.runMutation(internal.mentor.commitTurn, {
      conversationId: prepared.conversationId,
      body: prepared.body,
      turnKey: args.turnKey,
      response: reply.response,
      source: reply.source,
      model: reply.model,
      question: reply.question ?? undefined,
    });
    return { source: reply.source, model: reply.model };
  },
});

export const deleteMentorConversation = action({
  args: { conversationId: v.id("mentorConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const threadId = await ctx.runQuery(internal.mentor.prepareDeleteConversation, args);
    if (threadId) {
      try {
        await createMentorAgent(env.OPENCODE_ZEN_API_KEY?.trim() || "delete-only", configuredModel())
          .deleteThreadAsync(ctx, { threadId });
      } catch {
        console.warn("The Agent thread could not be deleted; deleting the SkillFlow chat record.");
      }
    }
    while (!(await ctx.runMutation(internal.mentor.deleteConversationRecords, args))) {
      // Each batch is a separate transaction so long chats remain deletable.
    }
    return null;
  },
});

export const clearMentor = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const threadIds = await ctx.runQuery(internal.mentor.prepareClear, {});
    for (const threadId of threadIds) {
      try {
        await createMentorAgent(env.OPENCODE_ZEN_API_KEY?.trim() || "clear-only", defaultModel)
          .deleteThreadAsync(ctx, { threadId });
      } catch {
        console.warn("The Agent thread could not be deleted; clearing the SkillFlow mentor record.");
      }
    }
    await ctx.runMutation(internal.mentor.clearRecords, {});
    return null;
  },
});
