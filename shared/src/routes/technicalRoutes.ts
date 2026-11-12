import { keys } from "ramda";
import { defineRoute, defineRoutes } from "shared-routes";
import { z } from "zod";
import {
  validateEmailInputSchema,
  validateEmailResponseSchema,
} from "../email/validateEmail.schema";
import { featureFlagsSchema } from "../featureFlag/featureFlags.schema";
import { htmlToPdfRequestSchema } from "../file/htmlToPdf";
import { withOptionalAuthorizationHeaders } from "../headers";
import { httpErrorSchema } from "../httpClient/httpErrors.schema";
import { brevoInboundBodySchema } from "../inboundEmailParsing/brevoInbound.schema";
import { makeHardenedStringSchema } from "../utils/string.schema";
import {
  emptyObjectSchema,
  expressEmptyResponseBody,
  timestampSchema,
} from "../zodUtils";

export type AvailableApiVersion = (typeof availableApiVersions)[number];
const availableApiVersions = ["v2", "v3"] as const;
const apiVersionSchema = z.enum(availableApiVersions).default("v2");

// @TODO: This should be a proper OpenAPI schema
const openApiSpecResponseSchema = z.any();

export type TechnicalRoutes = typeof technicalRoutes;

export const technicalRoutes = defineRoutes({
  htmlToPdf: defineRoute({
    method: "post",
    url: "/auth/html-to-pdf",
    ...withOptionalAuthorizationHeaders,
    requestBodySchema: htmlToPdfRequestSchema,
    responses: {
      200: z.string(),
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  openApiSpec: defineRoute({
    method: "get",
    queryParamsSchema: z.object({
      version: apiVersionSchema,
    }),
    url: "/open-api-spec",
    responses: { 200: openApiSpecResponseSchema },
  }),
  shortLink: defineRoute({
    method: "get",
    url: "/to/:shortLinkId",
    responses: {
      302: emptyObjectSchema,
      404: httpErrorSchema,
    },
  }),
  featureFlags: defineRoute({
    method: "get",
    url: "/feature-flags",
    queryParamsSchema: z
      .record(
        makeHardenedStringSchema({ max: 13, min: 7 }),
        makeHardenedStringSchema({ max: 0, min: 0 }),
      )
      .refine((record) => {
        const [key, second] = keys(record);
        if (!key) return true;
        if (second) return false;
        const keyAsNumber = Number.parseInt(key, 10);
        if (Number.isNaN(keyAsNumber)) return false;
        return timestampSchema.safeParse(keyAsNumber).success;
      }, "Le format des paramètres est invalide")
      .or(z.null()),
    responses: { 200: featureFlagsSchema, 400: httpErrorSchema },
  }),
  inboundEmailParsing: defineRoute({
    method: "post",
    url: "/inbound-email-parsing",
    requestBodySchema: brevoInboundBodySchema,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      403: emptyObjectSchema,
    },
  }),
  validateEmail: defineRoute({
    method: "get",
    url: "/validate-email",
    queryParamsSchema: validateEmailInputSchema,
    responses: {
      200: validateEmailResponseSchema,
      400: httpErrorSchema,
    },
  }),

  npsValidatedConvention: defineRoute({
    method: "post",
    url: "/nps-validated-convention",
    requestBodySchema: z.any(), // could not find better to not mutate the original object.
    // we need the original object to check the signature
    // validation is still checked in the usecase
    headersSchema: z.object({ "tally-signature": z.string() }).loose(),
    responses: {
      201: expressEmptyResponseBody,
      403: httpErrorSchema,
    },
  }),

  delegationContactRequest: defineRoute({
    // this corresponds to this tally form : https://tally.so/forms/w7WM49
    method: "post",
    url: "/delegation-contact-request",
    requestBodySchema: z.any(), // could not find better to not mutate the original object.
    // we need the original object to check the signature
    // validation is still checked in the usecase
    headersSchema: z.object({ "tally-signature": z.string() }).loose(),
    responses: {
      201: expressEmptyResponseBody,
      403: httpErrorSchema,
    },
  }),

  sendTicketToCrisp: defineRoute({
    // this corresponds to this tally form : https://tally.so/forms/mBdQQe
    method: "post",
    url: "/send-ticket-to-crisp",
    requestBodySchema: z.any(), // could not find better to not mutate the original object.
    // we need the original object to check the signature
    // validation is still checked in the usecase
    headersSchema: z.object({ "tally-signature": z.string() }).loose(),
    responses: {
      201: expressEmptyResponseBody,
      403: httpErrorSchema,
    },
  }),
});
