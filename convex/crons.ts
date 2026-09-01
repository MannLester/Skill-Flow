import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("clean expired media uploads", { hours: 1 }, internal.media.sweepExpired, {});

export default crons;
