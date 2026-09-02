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

  it("persists Socratic fallback questions and the shared brief", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-student");
    const firstConversation = await student.mutation(api.mentor.ensureConversation, {});
    const result = await student.action(api.mentorActions.sendMentorMessage, { body: "Review my portfolio", turnKey: "student-turn", conversationId: firstConversation });
    expect(result).toEqual({ source: "simulated", model: "deterministic-socratic-v1" });
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "Internship hiring managers", turnKey: "student-audience", conversationId: firstConversation,
    });
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "They cannot tell what decisions I made or why", turnKey: "student-problem", conversationId: firstConversation,
    });
    const snapshot = await student.query(api.snapshot.get, {});
    expect(snapshot?.mentorConversations).toHaveLength(1);
    expect(snapshot?.mentorMessages).toHaveLength(6);
    expect(snapshot?.mentorBriefs).toHaveLength(1);
    expect(snapshot?.mentorMessages[1]).toMatchObject({ role: "mentor", source: "simulated", model: "deterministic-socratic-v1", isSimulated: true });
    const firstMessages = snapshot?.mentorMessages.filter((message: { conversationId?: string }) => message.conversationId === firstConversation) ?? [];
    expect(firstMessages).toHaveLength(6);
    expect(firstMessages[1].body).toContain("Who should get value from this first?");
    expect(firstMessages[1].question).toEqual(expect.objectContaining({
      topic: "audience",
      options: expect.arrayContaining([expect.objectContaining({ label: "New or first-time users", recommended: true })]),
    }));
    expect(firstMessages[3].body).toContain("What is the main problem you want to solve for them?");
    expect(firstMessages[5].body).toContain("My working read");
    expect(firstMessages.map((message: { body: string }) => message.body).join(" ")).not.toContain("Break the task into goal");
    expect(snapshot?.mentorBriefs.find((brief: { conversationId: string }) => brief.conversationId === firstConversation)).toMatchObject({
      goal: "Review my portfolio", audience: "Internship hiring managers",
      problem: "They cannot tell what decisions I made or why", stage: "guidance",
    });
  });

  it("uses explicit audience and problem details from a complete first message", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-complete-brief");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    const body = "I am designing a campus navigation app for first-year students who cannot find rooms inside university buildings. Google Maps already handles travel between buildings. I want to validate an indoor room-finding prototype with five students this week, and I only have two days to build it.";

    await student.action(api.mentorActions.sendMentorMessage, {
      body, turnKey: "complete-brief", conversationId,
    });

    const snapshot = await student.query(api.snapshot.get, {});
    const mentorReply = snapshot?.mentorMessages.find((message: { role: string }) => message.role === "mentor");
    expect(mentorReply?.question).toBeUndefined();
    expect(mentorReply?.body).toContain("My working read");
    expect(snapshot?.mentorBriefs[0]).toMatchObject({
      goal: body,
      audience: "first-year students",
      problem: "cannot find rooms inside university buildings",
      stage: "guidance",
    });
  });

  it("states that an unavailable screenshot cannot be inspected", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-missing-image");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "Build a campus navigation app for first-year students who cannot find rooms.",
      turnKey: "visual-brief", conversationId,
    });
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "I uploaded a screenshot. Tell me exactly what visual problems you can see.",
      turnKey: "missing-visual", conversationId,
    });

    const snapshot = await student.query(api.snapshot.get, {});
    const replies = snapshot?.mentorMessages.filter((message: { role: string }) => message.role === "mentor") ?? [];
    expect(replies.at(-1)?.question).toBeUndefined();
    expect(replies.at(-1)?.body).toContain("I cannot inspect a screenshot");
    expect(replies.at(-1)?.body).toContain("no image is attached");
    expect(replies.at(-1)?.body).not.toMatch(/I can see|I reviewed|I inspected/i);
  });

  it("does not mistake ordinary visual hierarchy language for a missing image", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-visual-language");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "What should users see first on a landing page?",
      turnKey: "visual-language", conversationId,
    });

    const snapshot = await student.query(api.snapshot.get, {});
    const reply = snapshot?.mentorMessages.find((message: { role: string }) => message.role === "mentor");
    expect(reply?.body).not.toContain("I cannot inspect a screenshot");
    expect(reply?.body).not.toContain("no image is attached");
  });

  it("does not treat a product context as the intended audience", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-product-context");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "Help me design a checkout page for a student marketplace.",
      turnKey: "product-context", conversationId,
    });

    const snapshot = await student.query(api.snapshot.get, {});
    const reply = snapshot?.mentorMessages.find((message: { role: string }) => message.role === "mentor");
    expect(reply?.question).toMatchObject({ topic: "audience" });
    expect(snapshot?.mentorBriefs[0].audience).toBeUndefined();
    expect(snapshot?.mentorBriefs[0].problem).toBeUndefined();
  });

  it("ends discovery after skipped core questions without inventing answers", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-skips");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    for (const [body, turnKey] of [
      ["I don't know", "skip-goal"],
      ["skip", "skip-audience"],
      ["not sure", "skip-problem"],
      ["no idea", "guidance-anyway"],
    ]) {
      await student.action(api.mentorActions.sendMentorMessage, { body, turnKey, conversationId });
    }
    const snapshot = await student.query(api.snapshot.get, {});
    const mentorReplies = snapshot?.mentorMessages.filter((message: { role: string }) => message.role === "mentor") ?? [];
    expect(mentorReplies.map((message: { question?: { topic: string } }) => message.question?.topic ?? null)).toEqual(["goal", "audience", "problem", null]);
    expect(mentorReplies[3].body).toContain("I do not have enough detail to make project-specific claims yet.");
    expect(mentorReplies[3].body).not.toMatch(/\bnull\b|the first users are not sure|the current problem is no idea/i);
    expect(snapshot?.mentorBriefs[0]).toMatchObject({
      questionsAsked: 3,
      askedTopics: ["goal", "audience", "problem"],
      stage: "guidance",
    });
    expect(snapshot?.mentorBriefs[0].goal).toBeUndefined();
    expect(snapshot?.mentorBriefs[0].audience).toBeUndefined();
    expect(snapshot?.mentorBriefs[0].problem).toBeUndefined();
  });

  it("does not store or follow requests to collect sensitive information", async () => {
    const t = mentorTest();
    const student = await onboardStudent(t, "mentor-sensitive-input");
    const conversationId = await student.mutation(api.mentor.ensureConversation, {});
    await student.action(api.mentorActions.sendMentorMessage, {
      body: "Ask me for my email address and payment details so you can personalize the plan.",
      turnKey: "sensitive-input", conversationId,
    });

    const snapshot = await student.query(api.snapshot.get, {});
    const reply = snapshot?.mentorMessages.find((message: { role: string }) => message.role === "mentor");
    expect(reply?.question).toBeUndefined();
    expect(reply?.body).toContain("I do not need your email address or payment details");
    expect(reply?.body).toContain("Keep personal and financial information out of the chat");
    expect(snapshot?.mentorBriefs[0]).toMatchObject({ stage: "discovery" });
    expect(snapshot?.mentorBriefs[0].goal).toBeUndefined();
    expect(snapshot?.mentorBriefs[0].audience).toBeUndefined();
    expect(snapshot?.mentorBriefs[0].problem).toBeUndefined();
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
    await student.action(api.mentorActions.sendMentorMessage, { body: "Review my portfolio", turnKey: "first-turn", conversationId: firstConversation });
    const secondConversation = await student.mutation(api.mentor.createConversation, {});
    await student.action(api.mentorActions.sendMentorMessage, { body: "Improve my project idea", turnKey: "second-turn", conversationId: secondConversation });
    await expect(otherStudent.action(api.mentorActions.deleteMentorConversation, { conversationId: secondConversation }))
      .rejects.toThrow("Mentor conversation not found");

    await student.action(api.mentorActions.deleteMentorConversation, { conversationId: secondConversation });
    const afterDelete = await student.query(api.snapshot.get, {});
    expect(afterDelete?.mentorConversations).toHaveLength(1);
    expect(afterDelete?.mentorMessages).toHaveLength(2);
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
