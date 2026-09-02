import { z } from "zod";
import { toLowerCaseWithoutDiacritics } from "../utils/string";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import type { EmailType, TemplatedEmail } from "./email";
import type { Email, EmailAttachment } from "./email.dto";

export const emailAttachmentSchema: ZodSchemaWithInputMatchingOutput<EmailAttachment> =
  z
    .object({
      name: z.string(),
      content: z.string(),
    })
    .or(z.object({ url: z.string() }));

const emailTypeSchema =
  z.string() as ZodSchemaWithInputMatchingOutput<EmailType>;

// Waiting zod release for bad email regex
const temporaryEmailRegex =
  /^[A-Z0-9._+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i;
export const emailSchema: ZodSchemaWithInputMatchingOutput<Email> = z
  .string({
    error: localization.required,
  })
  .transform((arg) => toLowerCaseWithoutDiacritics(arg.trim()))
  .pipe(
    //Temporary regex instead of email - waiting zod release
    z.string().regex(temporaryEmailRegex, {
      error: (error) =>
        `${localization.invalidEmailFormat}${error.input && error.input.length > 0 ? ` - email fourni : '${error.input}'` : ""}`,
    }),
  );

export const templatedEmailSchema = z.object({
  kind: emailTypeSchema,
  recipients: z.array(z.string().transform((arg) => arg.trim())),
  cc: z.array(z.string().transform((arg) => arg.trim())).optional(),
  params: z.any(),
}) as ZodSchemaWithInputMatchingOutput<TemplatedEmail>;

export const emailPossiblyEmptySchema = emailSchema
  .transform((s) => s.trim())
  .optional()
  .or(z.literal(""));
