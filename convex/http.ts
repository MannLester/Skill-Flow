import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/media",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const value = new URL(request.url).searchParams.get("attachmentId");
    if (!value) return new Response("Missing attachmentId", { status: 400 });
    const storageId = await ctx.runQuery(internal.media.authorizeDownload, { attachmentId: value as Id<"mediaAttachments"> });
    if (!storageId) return new Response("Not found", { status: 404 });
    const blob = await ctx.storage.get(storageId);
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob, {
      status: 200,
      headers: { "Content-Type": blob.type || "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  }),
});

export default http;
