import { flatten } from "ramda";
import { errors, type ZodSchemaWithInputMatchingOutput } from "shared";
import type { ZodError } from "zod";
import type { $ZodIssue } from "zod/v4/core";
import type { OpacifiedLogger } from "../../utils/logger";

export const validateAndParseZodSchema = <T>(
  props: {
    inputSchema: ZodSchemaWithInputMatchingOutput<T>;
    schemaParsingInput: unknown;
    logger: OpacifiedLogger;
    id?: string;
  } & ({ schemaName: string } | { useCaseName: string }),
): T => {
  const result = props.inputSchema.safeParse(props.schemaParsingInput);
  if (result.success) return result.data;
  const flattenErrors = flattenZodErrors(result.error);
  const error = errors.inputs.badSchema({
    id: props.id,
    flattenErrors,
    ...("schemaName" in props
      ? { schemaName: props.schemaName }
      : { useCaseName: props.useCaseName }),
  });

  props.logger.error({
    message: `${error.message}${
      error.issues?.length
        ? `
    Issues:
    ${error.issues.join("\n")}`
        : ""
    }${"schemaName" in props && props.schemaName === "externalFtConnectUserSchema" ? `\n Input: ${JSON.stringify(props.schemaParsingInput)}` : ""}`,
  });

  throw error;
};

const flattenZodErrors = (
  error: ZodError<any>,
  path: PropertyKey[] = [],
): string[] => {
  const result = error.issues.reduce<string[]>((acc, issue: $ZodIssue) => {
    const currentPath = [...path, ...(issue.path || [])];

    return [...acc, ...flattenZodIssue(issue, currentPath)];
  }, []);

  return Array.from(new Set(result));
};

const flattenZodIssue = (
  issue: $ZodIssue,
  path: PropertyKey[] = [],
): string[] => {
  if (issue.code === "invalid_union" && issue.errors) {
    const unionErrors = flatten(issue.errors);
    const unionMessages = unionErrors.reduce<string[]>(
      (unionMsgs: string[], currentIssue: $ZodIssue) => {
        return unionMsgs.concat(
          flattenZodIssue(currentIssue, [...path, ...currentIssue.path]),
        );
      },
      [],
    );
    return unionMessages;
  }

  const key = path.join(".");
  const message = issue.message;
  const flatMessage = key ? `${key} : ${message}` : message;
  return [flatMessage];
};
