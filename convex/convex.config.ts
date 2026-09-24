import { defineApp } from "convex/server";
import { v } from "convex/values";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp({
  env: {
    OPENCODE_GO_API_KEY: v.optional(v.string()),
    OPENCODE_GO_MODEL: v.optional(v.string()),
    MENTOR_MOCK_REPLY: v.optional(v.string()),
    MENTOR_MOCK_FAILURE: v.optional(v.string()),
  },
});
app.use(agent);

export default app;
