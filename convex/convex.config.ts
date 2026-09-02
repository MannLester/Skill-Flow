import { defineApp } from "convex/server";
import { v } from "convex/values";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp({
  env: {
    OPENCODE_ZEN_API_KEY: v.optional(v.string()),
    OPENCODE_ZEN_MODEL: v.optional(v.string()),
    OPENCODE_ZEN_CHAT_MODEL: v.optional(v.string()),
  },
});
app.use(agent);

export default app;
