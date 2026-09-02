import { v } from "convex/values";

export const mentorSource = v.union(v.literal("simulated"), v.literal("opencode_zen"));
export const mentorQuestionTopic = v.union(
  v.literal("goal"), v.literal("audience"), v.literal("problem"), v.literal("constraints"),
  v.literal("deliverable"), v.literal("successCriterion"),
);
export const mentorQuestionOption = v.object({
  label: v.string(), description: v.optional(v.string()), recommended: v.boolean(),
});
export const mentorQuestion = v.object({
  text: v.string(), topic: mentorQuestionTopic, options: v.array(mentorQuestionOption),
});

export type MentorQuestionTopic = "goal" | "audience" | "problem" | "constraints" | "deliverable" | "successCriterion";
export const coreMentorTopics: MentorQuestionTopic[] = ["goal", "audience", "problem"];
export const maxDiscoveryQuestions = 4;

export function isNonAnswer(text: string) {
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/g, "");
  return /^(i (?:do not|don't) know|not sure|unsure|no idea|skip|pass|you decide|what do you mean|can you explain)(?:\s+(?:yet|that|this|please))?$/.test(normalized);
}

export function requestsSensitiveInformation(text: string) {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  const sensitive = "password|api key|credit card|bank|payment details|student number|government id|client data|client name|email address|phone number|home address|full name";
  return new RegExp(`\\b(?:ask|request|prompt)\\b.{0,30}\\b(?:me|user|student)\\b.{0,90}\\b(?:for\\s+)?(?:my\\s+)?(?:${sensitive})\\b`).test(normalized);
}

export function mentorOutputViolation(text: string) {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  const sensitive = "password|api key|credit card|bank|payment details|student number|government id|client data|client name|email address|phone number|home address|full name";
  if (new RegExp(`\\b(?:send|share|provide|upload|give|tell|enter)\\b.{0,70}\\b(?:${sensitive})\\b|\\b(?:what is|what's) your\\s+(?:${sensitive})\\b`).test(normalized)) return "sensitive-information request";
  if (/\b(?:i can see|i reviewed|i inspected|i looked at|looking at)\s+(?:your\s+)?(?:image|screenshot|uploaded file|design file)\b|\b(?:from|in) your\s+(?:image|screenshot|uploaded file|design file)\b/.test(normalized)) return "unsupported visual claim";
  if (/\b(?:guarantee|guaranteed|get you hired|get you a job|ensure you get|will definitely succeed)\b/.test(normalized)) return "guaranteed outcome";
  if (/\b(?:your users said|research shows|studies show|the data shows)\b/.test(normalized)) return "unsupported evidence claim";
  return null;
}

export function containsQuestion(text: string) {
  return text.includes("?");
}
