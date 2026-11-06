/**
 * src/http/express-lite.js
 *
 * A small, dependency-free subset of the Express 4 router API that runs on the
 * Cloudflare Workers runtime. It exists so the request handlers (controllers,
 * middleware, validation) can keep their familiar `(req, res, next)` shape while
 * the server runs as a Worker instead of a Node HTTP server.
 *
 * Supported surface (everything the API uses):
 *   Router(): router.use([path], fn | router), router.get|post|put|patch|delete(path, ...fns)
 *   req: method, path, query, params, headers, body, ip, user (set by middleware)
 *   res: status(), set()/setHeader(), json(), send(), redirect(), end(), sendStatus(), locals
 *   Error handlers: any middleware declared with four arguments (err, req, res, next)
 *
 * Request bodies are parsed here as JSON only, with a hard size cap. Anything
 * else (multipart, urlencoded) is intentionally unsupported: uploads stream
 * straight into R2 via PUT.
 */

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

const PARAM_PATTERN = /:([A-Za-z_][A-Za-z0-9_]*)/g;

function compilePath(path, { end }) {
  if (path === "*" || path === "") return { regex: /^.*$/, keys: [] };
  const keys = [];
  const source = path
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(PARAM_PATTERN, (_, key) => {
      keys.push(key);
      return "([^/]+)";
    })
    .replace(/\/+$/, "");
  return { regex: new RegExp(`^${source || ""}${end ? "/?$" : "(?=/|$)"}`), keys };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "Malformed URL parameter.");
  }
}

function matchPrefix(pathname, prefix) {
  if (!prefix || prefix === "/") return pathname;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return null;
}

/** Express-style router. Layers run in registration order. */
export function Router() {
  const stack = [];

  const addRoute = (method, path, handlers) => {
    const { regex, keys } = compilePath(path, { end: true });
    for (const handler of handlers.flat()) {
      stack.push({ kind: "route", method, regex, keys, handler });
    }
    return router;
  };

  const router = {
    stack,
    use(...args) {
      let prefix = "";
      if (typeof args[0] === "string") prefix = args.shift().replace(/\/+$/, "");
      for (const handler of args.flat()) {
        stack.push({ kind: "use", prefix, handler, isRouter: typeof handler?.handle === "function" });
      }
      return router;
    },
    get: (path, ...handlers) => addRoute("GET", path, handlers),
    post: (path, ...handlers) => addRoute("POST", path, handlers),
    put: (path, ...handlers) => addRoute("PUT", path, handlers),
    patch: (path, ...handlers) => addRoute("PATCH", path, handlers),
    delete: (path, ...handlers) => addRoute("DELETE", path, handlers),

    /**
     * Dispatch a request through this router's layers. `done(err)` is called
     * when no layer handled the request.
     */
    handle(req, res, done) {
      let index = 0;
      const pathname = req.path;

      const next = (err) => {
        // Restore pathname if a mounted sub-router was exited.
        req.path = pathname;
        while (index < stack.length) {
          const layer = stack[index++];

          if (layer.kind === "use") {
            const isErrorHandler = !layer.isRouter && layer.handler.length === 4;
            if (!!err !== isErrorHandler && !layer.isRouter) continue;
            if (err && layer.isRouter) continue;
            const rest = matchPrefix(pathname, layer.prefix);
            if (rest === null) continue;

            if (layer.isRouter) {
              req.path = rest;
              invoke(() => layer.handler.handle(req, res, (childErr) => {
                req.path = pathname;
                next(childErr);
              }));
              return;
            }

            req.path = rest;
            const finished = invoke(() => layer.handler(...(err ? [err, req, res, next] : [req, res, next])));
            if (finished) return;
            continue;
          }

          // Route layer
          if (err) continue;
          if (layer.method !== req.method) continue;
          const match = layer.regex.exec(pathname);
          if (!match) continue;
          req.params = { ...(req.params || {}), ...Object.fromEntries(layer.keys.map((k, i) => [k, safeDecode(match[i + 1])])) };
          if (layer.handler.length === 4) continue;
          const finished = invoke(() => layer.handler(req, res, next));
          if (finished) return;
        }
        req.path = pathname;
        if (done) return done(err);
        if (err) throw err;
        return undefined;
      };

      // Wrap a handler call: sync throws and async rejections continue to the error path.
      const invoke = (fn) => {
        try {
          const result = fn();
          if (result && typeof result.then === "function") {
            result.catch((error) => next(error));
            return true;
          }
          return true;
        } catch (error) {
          next(error);
          return true;
        }
      };

      next();
    },
  };

  return router;
}

/**
 * Creates the response object for one request. `res.finished` resolves once a
 * body has been set; `res.toResponse()` builds the Fetch Response.
 */
export function createResponse() {
  let statusCode = 200;
  const headers = new Headers();
  let body = null;
  let rawStream = null;
  let ended = false;
  let resolveFinished;
  const finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  const finish = () => {
    if (ended) return;
    ended = true;
    resolveFinished();
  };

  const res = {
    locals: {},
    finished,
    get headersSent() {
      return ended;
    },
    status(code) {
      statusCode = code;
      return res;
    },
    set(name, value) {
      if (name && typeof name === "object") {
        for (const [key, val] of Object.entries(name)) headers.set(key, String(val));
      } else {
        headers.set(name, String(value));
      }
      return res;
    },
    setHeader(name, value) {
      return res.set(name, value);
    },
    getHeader(name) {
      return headers.get(name) ?? undefined;
    },
    json(payload) {
      if (ended) return res;
      headers.set("content-type", "application/json; charset=utf-8");
      body = JSON.stringify(payload);
      finish();
      return res;
    },
    send(payload) {
      if (ended) return res;
      if (payload !== null && typeof payload === "object") return res.json(payload);
      if (!headers.has("content-type")) headers.set("content-type", "text/plain; charset=utf-8");
      body = payload === undefined || payload === null ? "" : String(payload);
      finish();
      return res;
    },
    sendStatus(code) {
      statusCode = code;
      body = null;
      finish();
      return res;
    },
    redirect(a, b) {
      const location = typeof a === "number" ? b : a;
      statusCode = typeof a === "number" ? a : 302;
      headers.set("location", location);
      body = null;
      finish();
      return res;
    },
    end(payload) {
      if (ended) return res;
      body = payload ?? null;
      finish();
      return res;
    },
    /** Streams a ReadableStream (e.g. an R2 object) with explicit status and headers. */
    stream(code, extraHeaders, readable) {
      if (ended) return res;
      statusCode = code;
      for (const [key, value] of Object.entries(extraHeaders || {})) headers.set(key, String(value));
      rawStream = readable;
      finish();
      return res;
    },
    /** Headers accumulated so far (used to add security headers before routing completes). */
    headers,
    toResponse() {
      const payload = rawStream ?? body;
      const nullBody = statusCode === 204 || statusCode === 304;
      return new Response(nullBody ? null : payload, { status: statusCode, headers });
    },
  };
  return res;
}

/** Maps an error to [status, public message]. Internal details are never exposed. */
export function errorResponse(error) {
  if (error?.type === "entity.parse.failed") return [400, "Invalid JSON in request body."];
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return [413, "Request body too large. Maximum allowed size is 100KB for JSON requests."];
  }
  if (error instanceof HttpError) return [error.status, error.message];
  return [500, "Something went wrong on the server."];
}
