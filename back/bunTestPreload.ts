import { mock } from "bun:test";

// Bun crashes when loading the V8 native addon of @sentry/profiling-node: https://bun.com/docs/runtime/nodejs-compat
mock.module("@sentry/profiling-node", () => ({
  nodeProfilingIntegration: () => ({ name: "ProfilingIntegration" }),
}));
