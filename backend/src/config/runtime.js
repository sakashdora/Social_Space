/**
 * src/config/runtime.js
 *
 * Per-request runtime handles: Worker bindings and the execution context.
 * Set once at the start of each request/scheduled invocation by worker.js.
 */

export const runtime = {
  bindings: {},
  ctx: null,
};

export function setRuntime(bindings, ctx) {
  runtime.bindings = bindings || {};
  runtime.ctx = ctx || null;
}
