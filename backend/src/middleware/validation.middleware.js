/**
 * src/middleware/validation.middleware.js
 *
 * Middleware to validate the request body against a Zod schema.
 * Rejects with a consistent error structure if validation fails.
 */

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues || result.error.errors || [];
      const formattedErrors = errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("; ");
      
      return res.status(400).json({
        error: {
          message: `Validation failed: ${formattedErrors}`,
          code: "VALIDATION_ERROR",
        },
      });
    }
    // Replace req.body with the parsed/validated data (handles type coercion, stripping unregistered fields)
    req.body = result.data;
    next();
  };
}
