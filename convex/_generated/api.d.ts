/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as communication from "../communication.js";
import type * as crons from "../crons.js";
import type * as devSeed from "../devSeed.js";
import type * as growth from "../growth.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_events from "../lib/events.js";
import type * as media from "../media.js";
import type * as profiles from "../profiles.js";
import type * as projects from "../projects.js";
import type * as services from "../services.js";
import type * as snapshot from "../snapshot.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  communication: typeof communication;
  crons: typeof crons;
  devSeed: typeof devSeed;
  growth: typeof growth;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/events": typeof lib_events;
  media: typeof media;
  profiles: typeof profiles;
  projects: typeof projects;
  services: typeof services;
  snapshot: typeof snapshot;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
