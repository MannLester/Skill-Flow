/// <reference types="vite/client" />

import { register as registerAgent } from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { containsQuestion, isFactSupportedByMessage, isNonAnswer, mentorOutputViolation, requestsSensitiveInformation } from "./lib/mentor";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = (subject: string) => ({
  subject,
  issuer: "https://skillflow-tests.clerk.accounts.dev",
  tokenIdentifier: `https://skillflow-tests.clerk.accounts.dev|${subject}`,
});

afterEach(() => {
  delete process.env.OPENCODE_ZEN_API_KEY;
  delete process.env.OPENCODE_ZEN_MODEL;
  delete process.env.OPENCODE_ZEN_CHAT_MODEL;
});

function mentorTest() {
  const t = convexTest(schema, modules);
  registerAgent(t);
  return t;
}

async function onboardStudent(t: ReturnType<typeof mentorTest>, subject: string, name = "Mentor Student") {
  const student = t.withIdentity(identity(subject));
  await student.mutation(api.profiles.completeOnboarding, { role: "student", name });
  return student;
}

describe("AI Project Mentor", () => {
  it("allows only Student Designers", async () => {
    const t = mentorTest();
    const client = t.withIdentity(identity("mentor-client"));
    await client.mutation(api.profiles.completeOnboarding, { role: "client", name: "Mentor Client" });
    await expect(t.action(api.mentorActions.sendMentorMessage, { body: "Review my portfolio", turnKey: "anonymous" }))
      .rejects.toThrow("Authentication required");
    await expect(client.action(api.mentorActions.sendMentorMessage, { body: "Review my portfolio", turnKey: "client" }))
      .rejects.toThrow("Student Designer access required");
  });

  it("rejects mentor turns when the AI provider is not configured", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-unconfigured");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    await expect(student.action(api.mentorActions.sendMentorMessage, {
      body: "Review my portfolio", turnKey: "unconfigured-turn", conversationId,
    })).rejects.toThrow("not set up");
    const snapshot = await student.query(api.snapshot.get, {});
    expect(snapshot?.mentorMessages).toHaveLength(0);
  });

  it("builds the shared brief across prepared turns", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-student");
    const firstConversation = await student.mutation(api.mentor.ensureConversation, {});
    const goal = await student.mutation(internal.mentor.prepareTurn, { body: "Review my portfolio", turnKey: "student-turn", conversationId: firstConversation });
    expect(goal.kind).toBe("ready");
    if (goal.kind !== "ready") throw new Error("First turn was not prepared.");
    expect(goal.brief.goal).toBe("Review my portfolio");
    expect(goal.brief.stage).toBe("discovery");
    await student.mutation(internal.mentor.recordQuestion, { conversationId: firstConversation, topic: "audience", question: "Who should get value from this first?" });
    const audience = await student.mutation(internal.mentor.prepareTurn, { body: "Internship hiring managers", turnKey: "student-audience", conversationId: firstConversation });
    if (audience.kind !== "ready") throw new Error("Audience turn was not prepared.");
    await student.mutation(internal.mentor.recordQuestion, { conversationId: firstConversation, topic: "problem", question: "What is the main problem you want to solve for them?" });
    const problem = await student.mutation(internal.mentor.prepareTurn, { body: "They cannot tell what decisions I made or why", turnKey: "student-problem", conversationId: firstConversation });
    if (problem.kind !== "ready") throw new Error("Problem turn was not prepared.");
    expect(problem.brief).toMatchObject({
      goal: "Review my portfolio", audience: "Internship hiring managers",
      problem: "They cannot tell what decisions I made or why", stage: "guidance",
    });
  });

  it("uses explicit audience and problem details from a complete first message", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-complete-brief");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    const body = "I am designing a campus navigation app for first-year students who cannot find rooms inside university buildings. Google Maps already handles travel between buildings. I want to validate an indoor room-finding prototype with five students this week, and I only have two days to build it.";

    const prepared = await student.mutation(internal.mentor.prepareTurn, {
      body, turnKey: "complete-brief", conversationId,
    });
    if (prepared.kind !== "ready") throw new Error("Complete turn was not prepared.");
    expect(prepared.brief).toMatchObject({
      goal: body,
      audience: "first-year students",
      problem: "cannot find rooms inside university buildings",
      stage: "guidance",
    });
  });

  it("does not treat a product context as the intended audience", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-product-context");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    const prepared = await student.mutation(internal.mentor.prepareTurn, {
      body: "Help me design a checkout page for a student marketplace.",
      turnKey: "product-context", conversationId,
    });
    if (prepared.kind !== "ready") throw new Error("Product turn was not prepared.");
    expect(prepared.brief.audience).toBeNull();
    expect(prepared.brief.problem).toBeNull();
    expect(prepared.brief.stage).toBe("discovery");
  });

  it("does not store requests to collect sensitive information", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-sensitive-input");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    const prepared = await student.mutation(internal.mentor.prepareTurn, {
      body: "Ask me for my email address and payment details so you can personalize the plan.",
      turnKey: "sensitive-input", conversationId,
    });
    if (prepared.kind !== "ready") throw new Error("Sensitive turn was not prepared.");
    expect(prepared.brief.stage).toBe("discovery");
    expect(prepared.brief.goal).toBeNull();
    expect(prepared.brief.audience).toBeNull();
    expect(prepared.brief.problem).toBeNull();
  });

  it("rejects repeated questions and all questions after guidance begins", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-question-guard");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    const first = await student.mutation(internal.mentor.recordQuestion, { conversationId, topic: "audience", question: "Who is this for?" });
    expect(first).toMatchObject({ questionsAsked: 1, askedTopics: ["audience"], openQuestionTopic: "audience" });
    const repeated = await student.mutation(internal.mentor.recordQuestion, { conversationId, topic: "audience", question: "Who exactly is this for?" });
    expect(repeated).toMatchObject({ questionsAsked: 1, askedTopics: ["audience"], openQuestion: "Who is this for?" });
    const guided = await student.mutation(internal.mentor.updateBrief, {
      conversationId, goal: "Build a campus navigation app", audience: "Campus students", problem: "They cannot find rooms inside buildings",
    });
    expect(guided.stage).toBe("guidance");
    const afterGuidance = await student.mutation(internal.mentor.recordQuestion, { conversationId, topic: "constraints", question: "What is your budget?" });
    expect(afterGuidance).toMatchObject({ questionsAsked: 1, askedTopics: ["audience"], stage: "guidance" });
  });

  it("deletes only chats owned by the current student", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-delete-student");
    const otherStudent = await onboardStudent(t, "mentor-other-student", "Other Mentor Student");
    const firstConversation = await student.mutation(api.mentor.ensureConversation, {});
    await student.mutation(internal.mentor.prepareTurn, { body: "Review my portfolio", turnKey: "first-turn", conversationId: firstConversation });
    const secondConversation = await student.mutation(api.mentor.createConversation, {});
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("profiles")
        .withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity("mentor-delete-student").tokenIdentifier))
        .unique();
      if (!profile) throw new Error("Test student profile was not created.");
      for (const [role, sequence, body, turnKey] of [["user", 0, "Improve my project idea", "second-turn"], ["mentor", 1, "Start with the smallest useful version.", "second-turn"]] as const) {
        await ctx.db.insert("mentorMessages", {
          studentProfileId: profile._id,
          conversationId: secondConversation,
          turnId: `${profile._id}:second-turn`,
          role, sequence, body, turnKey, createdAt: sequence,
        });
      }
    });
    await expect(otherStudent.action(api.mentorActions.deleteMentorConversation, { conversationId: secondConversation }))
      .rejects.toThrow("Mentor conversation not found");

    await student.action(api.mentorActions.deleteMentorConversation, { conversationId: secondConversation });
    const afterDelete = await student.query(api.snapshot.get, {});
    expect(afterDelete?.mentorConversations).toHaveLength(1);
    expect(afterDelete?.mentorMessages).toHaveLength(0);
    expect(afterDelete?.mentorBriefs).toHaveLength(1);
  });

  it("deletes chats that require more than one record batch", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-long-delete");
    const conversationId = await student.mutation(api.mentor.createConversation, {});
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("profiles")
        .withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity("mentor-long-delete").tokenIdentifier))
        .unique();
      if (!profile) throw new Error("Test student profile was not created.");
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("mentorMessages", {
          studentProfileId: profile._id,
          conversationId,
          turnId: `long-delete-${index}`,
          role: "user",
          sequence: 0,
          body: `Message ${index}`,
          turnKey: `long-delete-${index}`,
          createdAt: index,
        });
      }
    });

    await student.action(api.mentorActions.deleteMentorConversation, { conversationId });
    const snapshot = await student.query(api.snapshot.get, {});
    expect(snapshot?.mentorConversations).toHaveLength(0);
    expect(snapshot?.mentorMessages).toHaveLength(0);
    expect(snapshot?.mentorBriefs).toHaveLength(0);
  });
});

describe("mentor output policy", () => {
  it("recognizes skips without treating useful answers as missing", () => {
    expect(isNonAnswer("I don't know yet.")).toBe(true);
    expect(isNonAnswer("idk")).toBe(true);
    expect(isNonAnswer("I have no idea.")).toBe(true);
    expect(isNonAnswer("I dunno")).toBe(true);
    expect(isNonAnswer("I'm not sure")).toBe(true);
    expect(isNonAnswer("I’m not sure yet.")).toBe(true);
    expect(isNonAnswer("I have no clue")).toBe(true);
    expect(isNonAnswer("skip")).toBe(true);
    expect(isNonAnswer("Campus students who cannot find rooms")).toBe(false);
    expect(requestsSensitiveInformation("Ask me for my email address and payment details.")).toBe(true);
    expect(requestsSensitiveInformation("Help me design an email newsletter.")).toBe(false);
  });

  it("rejects sensitive requests, unsupported observations, guarantees, and invented evidence", () => {
    expect(mentorOutputViolation("Share your credit card details so I can help.")).toBe("sensitive-information request");
    expect(mentorOutputViolation("What is your email address?")).toBe("sensitive-information request");
    expect(mentorOutputViolation("I can see your screenshot has weak contrast.")).toBe("unsupported visual claim");
    expect(mentorOutputViolation("This will definitely succeed.")).toBe("guaranteed outcome");
    expect(mentorOutputViolation("Research shows this is what your users need.")).toBe("unsupported evidence claim");
    expect(mentorOutputViolation("A working assumption is that speed matters most.")).toBeNull();
  });

  it("detects unstructured questions", () => {
    expect(containsQuestion("Who is this for?")).toBe(true);
    expect(containsQuestion("Start with one small prototype.")).toBe(false);
  });

  it("accepts only project facts copied from the latest student message", () => {
    const message = "I am now targeting first-year students who get lost inside campus buildings.";
    expect(isFactSupportedByMessage(message, "first-year students")).toBe(true);
    expect(isFactSupportedByMessage(message, "students who need accessible routes")).toBe(false);
  });
});
