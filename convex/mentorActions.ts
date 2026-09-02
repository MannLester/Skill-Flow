"use node";

import { Agent, createThread, createTool, saveMessage } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs } from "ai";
import type { ToolSet } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { containsQuestion, isNonAnswer, maxDiscoveryQuestions, mentorOutputViolation, mentorSource, requestsSensitiveInformation } from "./lib/mentor";

const defaultModel = "muse-spark-1.2-contributor-free";
const simulatedModel = "deterministic-socratic-v1";
const instructions = `You are SkillFlow's project mentor for student designers. Work like a thoughtful Socratic mentor, not a grader or questionnaire.

Read the conversation and the current project brief before replying. Treat only the student's messages and the stored brief as project facts. Never invent research, user feedback, requirements, constraints, visual observations, or personal details. Label an inference as a working assumption. If the student's latest message adds or corrects a concrete fact, use updateProjectBrief. If one missing or conflicting detail prevents useful advice, use askStudent and ask exactly one focused question. Give two to four concrete, mutually exclusive answer choices and mark the choice you think is best as recommended. The student can still write a different answer. Do not ask for information the student already gave, and do not force every brief field to be filled. Once you understand the goal, the intended audience, and the real problem, state your working understanding in plain language and give a concrete recommendation. When the brief says the stage is guidance, do not ask another question unless the student explicitly asks you to clarify something.

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
type MentorReply = { response: string; source: "simulated" | "opencode_zen"; model: string; question: Question | null };
type PreparedTurn = {
  kind: "ready"; body: string; studentProfileId: Id<"profiles">;
  conversationId: Id<"mentorConversations">; agentThreadId: string | null; brief: Brief;
};

function capabilityQuestion(body: string) {
  return /\b(what can (you|u) do|how can (you|u) help|who are you)\b/i.test(body);
}

function unsupportedVisualRequest(body: string) {
  return /\b(?:uploaded|attached|shared)\b.{0,80}\b(?:image|screenshot|design|mockup|file)\b|\b(?:image|screenshot|design|mockup|screen)\b.{0,80}\b(?:see|visible)\b/i.test(body);
}

function nextQuestion(brief: Brief): Question | null {
  if (brief.stage === "guidance" || brief.questionsAsked >= maxDiscoveryQuestions) return null;
  if (!brief.goal && !brief.askedTopics.includes("goal")) return { topic: "goal", text: "What would you like to work on?", options: recommendedOptions("Build something", "Research something", "Plan something") };
  if (!brief.audience && !brief.askedTopics.includes("audience")) return { topic: "audience", text: "Who should get value from this first?", options: recommendedOptions("New or first-time users", "Existing users", "Clients or decision-makers") };
  if (!brief.problem && !brief.askedTopics.includes("problem")) return { topic: "problem", text: "What is the main problem you want to solve for them?", options: recommendedOptions("Save them time", "Reduce confusion", "Prevent mistakes") };
  return null;
}

function recommendedOptions(...labels: string[]): QuestionOption[] {
  return labels.map((label, index) => ({ label, recommended: index === 0 }));
}

function firstMove(brief: Brief) {
  const context = `${brief.goal ?? ""} ${brief.problem ?? ""}`.toLowerCase();
  if (context.includes("open source") || context.includes("workflow")) return "Write one real example that goes from input to useful output. Put it in a small public repo with a short README, setup steps, and the limitation you most want contributors to tackle.";
  if (context.includes("portfolio") || context.includes("case study")) return "Pick one project and write the problem, your key decision, and the result before touching the layout. That story will tell you what visuals the case study actually needs.";
  if (context.includes("design") || context.includes("interface")) return "Choose the single action the user must notice first, then test whether hierarchy, spacing, and contrast all point to it.";
  return "Define the smallest result that would prove the idea is useful, then build only enough to put that result in front of one intended user.";
}

function deterministicResponse(body: string, brief: Brief) {
  if (requestsSensitiveInformation(body)) {
    return { text: "I do not need your email address or payment details to mentor this project. Keep personal and financial information out of the chat. Share only the project goal and constraints that affect the work.", question: null };
  }
  if (unsupportedVisualRequest(body)) {
    return { text: "I cannot inspect a screenshot from this message because no image is attached in this chat. Describe the screen and the action you want users to take, and I can help review the hierarchy, spacing, contrast, and flow from your description.", question: null };
  }
  if (capabilityQuestion(body)) {
    return { text: "I can help you turn a rough idea into a workable plan, challenge weak assumptions, review a design decision, or shape a portfolio story. Bring me the messy version. We can figure out what matters before jumping to solutions.", question: null };
  }
  const question = nextQuestion(brief);
  if (question) return { text: question.text, question };
  const known = [brief.goal ? `the goal is ${brief.goal}` : null, brief.audience ? `the first users are ${brief.audience}` : null, brief.problem ? `the current problem is ${brief.problem}` : null].filter(Boolean);
  const understanding = known.length ? `My working read is that ${known.join(", and ")}.` : "I do not have enough detail to make project-specific claims yet.";
  return { text: `${understanding}\n\n${firstMove(brief)} If I have the problem wrong, correct that before you build anything.`, question: null };
}

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
  return process.env.OPENCODE_ZEN_MODEL?.trim()
    || process.env.OPENCODE_ZEN_CHAT_MODEL?.trim()
    || defaultModel;
}

function mentorTools(conversationId: Id<"mentorConversations">, allowQuestions: boolean): ToolSet {
  return {
    updateProjectBrief: createTool({
      description: "Save new or corrected project facts in the living mentor brief. Omit fields the student has not established.",
      inputSchema: z.object({
        goal: z.string().optional(), audience: z.string().optional(), problem: z.string().optional(),
        constraints: z.string().optional(), deliverable: z.string().optional(), successCriterion: z.string().optional(),
      }),
      execute: async (ctx, facts): Promise<Brief> => {
        const updated: Brief = await ctx.runMutation(internal.mentor.updateBrief, { conversationId, ...facts });
        return updated;
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

function createMentorAgent(apiKey: string, model: string, conversationId?: Id<"mentorConversations">, brief?: Brief): Agent<object, ToolSet> {
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
    tools: conversationId && brief ? mentorTools(conversationId, brief.stage === "discovery" && brief.questionsAsked < maxDiscoveryQuestions) : undefined,
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

function generatedReplyNeedsFallback(generated: string, question: Question | null, acceptedQuestion: boolean) {
  const questionMarks = generated.match(/\?/g)?.length ?? 0;
  return Boolean(mentorOutputViolation(generated))
    || Boolean(question && !acceptedQuestion)
    || (containsQuestion(generated) && !acceptedQuestion)
    || questionMarks > 1;
}

function finalizeGeneratedReply(generated: string, question: Question | null, brief: Brief, body: string, model: string): MentorReply {
  const acceptedQuestion = recordedQuestion(question, brief);
  if (generatedReplyNeedsFallback(generated, question, acceptedQuestion)) {
    const safe = deterministicResponse(body, brief);
    return { response: safe.text, source: "simulated", model: simulatedModel, question: safe.question };
  }
  return { response: generated, source: "opencode_zen", model, question: question && acceptedQuestion ? question : null };
}

async function generateMentorReply(ctx: ActionCtx, prepared: PreparedTurn, threadId: string, promptMessageId: string): Promise<MentorReply> {
  const fallback = deterministicResponse(prepared.body, prepared.brief);
  const apiKey = process.env.OPENCODE_ZEN_API_KEY?.trim();
  const model = configuredModel();
  if (!apiKey) return { response: fallback.text, source: "simulated" as const, model: simulatedModel, question: fallback.question };
  if (isNonAnswer(prepared.body) || requestsSensitiveInformation(prepared.body)) return { response: fallback.text, source: "simulated" as const, model: simulatedModel, question: fallback.question };
  try {
    const result = await createMentorAgent(apiKey, model, prepared.conversationId, prepared.brief).generateText(
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
    return finalizeGeneratedReply(generated, question, currentBrief, prepared.body, model);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown provider error";
    console.warn(`OpenCode Zen mentor request failed; using the simulated response. ${reason}`);
    return { response: fallback.text, source: "simulated" as const, model: simulatedModel, question: fallback.question };
  }
}

async function saveFallbackReply(ctx: ActionCtx, prepared: PreparedTurn, threadId: string, promptMessageId: string, response: string, question: Question | null) {
  if (question) {
    await ctx.runMutation(internal.mentor.recordQuestion, {
      conversationId: prepared.conversationId, topic: question.topic, question: question.text,
    });
  }
  await saveMessage(ctx, components.agent, {
    threadId, userId: prepared.studentProfileId, promptMessageId, agentName: "Simulated Mentor",
    message: { role: "assistant", content: response },
  });
}

export const sendMentorMessage = action({
  args: { body: v.string(), turnKey: v.string(), conversationId: v.optional(v.id("mentorConversations")) },
  returns: v.object({ source: mentorSource, model: v.string() }),
  handler: async (ctx, args): Promise<{ source: "simulated" | "opencode_zen"; model: string }> => {
    const prepared = await ctx.runMutation(internal.mentor.prepareTurn, args);
    if (prepared.kind === "duplicate") return { source: "simulated" as const, model: simulatedModel };
    const threadId = await ensureAgentThread(ctx, prepared);
    const prompt = await saveMessage(ctx, components.agent, {
      threadId, userId: prepared.studentProfileId, prompt: prepared.body,
    });
    const reply: MentorReply = await generateMentorReply(ctx, prepared, threadId, prompt.messageId);
    if (reply.source === "simulated") await saveFallbackReply(ctx, prepared, threadId, prompt.messageId, reply.response, reply.question);
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
        await createMentorAgent(process.env.OPENCODE_ZEN_API_KEY?.trim() || "delete-only", configuredModel())
          .deleteThreadAsync(ctx, { threadId });
      } catch {
        console.warn("The Agent thread could not be deleted; deleting the SkillFlow chat record.");
      }
    }
    await ctx.runMutation(internal.mentor.deleteConversationRecords, args);
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
        await createMentorAgent(process.env.OPENCODE_ZEN_API_KEY?.trim() || "clear-only", defaultModel)
          .deleteThreadAsync(ctx, { threadId });
      } catch {
        console.warn("The Agent thread could not be deleted; clearing the SkillFlow mentor record.");
      }
    }
    await ctx.runMutation(internal.mentor.clearRecords, {});
    return null;
  },
});
