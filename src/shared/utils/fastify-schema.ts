import { z } from 'zod';

/**
 * Converts a Zod schema to a JSON Schema object for use in Fastify route
 * schema.body / schema.params / schema.querystring.
 *
 * ## Why this exists
 *
 * Fastify requires JSON Schema (AJV) in its route `schema` option for two
 * independent purposes:
 *
 *   1. OpenAPI documentation  — Swagger reads the schema to describe the API.
 *   2. Response serialization — schema.response drives fast-json-stringify.
 *
 * For INPUT validation (body/params/querystring), Zod handles all business
 * rules via safeParse() in the route handler — including transforms that AJV
 * cannot express (.trim, .toLowerCase, .coerce).  Manually duplicating those
 * rules as hand-written JSON Schemas creates two maintenance surfaces that can
 * silently diverge.
 *
 * This utility generates the Fastify input schema automatically from the Zod
 * schema so that the Zod definition is the single source of truth.
 *
 * ## What changes and what doesn't
 *
 *   - schema.response — NOT touched (no Zod equivalent; drives serialization).
 *   - safeParse() in handlers — NOT removed (Zod still does actual validation
 *     and normalization; the generated AJV schema serves as a structural
 *     pre-flight and an accurate OpenAPI description).
 *
 * ## Behavior note
 *
 * With generated schemas, AJV enforces the same constraints as Zod at the
 * HTTP layer.  Previously, some Zod-only rules (e.g. password regex checks)
 * were not in the AJV schema; they are now.  The HTTP response stays identical
 * (400, VALIDATION_ERROR) — only the error's details.format may differ for
 * those edge cases.
 */
export function zodToFastify(schema: z.ZodTypeAny): Record<string, unknown> {
  // z.toJSONSchema is available in Zod v4 — no external dependency needed.
  const generated = z.toJSONSchema(schema) as Record<string, unknown>;

  // Strip the $schema URI if present — Fastify's AJV instance doesn't need it
  // and older versions may reject unknown root-level keys.
  const { $schema: _dropped, ...rest } = generated as { $schema?: unknown } & Record<string, unknown>;
  return rest;
}
