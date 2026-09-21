import type { ErrorNotificationsProps } from "react-design-system";
import { type FieldValues, type FormState, get } from "react-hook-form";
import {
  type AddressDto,
  type DotNestedKeys,
  keys,
  toDotNotation,
} from "shared";
import type {
  FormFieldAttributes,
  FormFieldAttributesForContent,
} from "../contents/forms/types";

export type FormFieldsObject<T> = Record<keyof T, FormFieldAttributes>;
export type FormFieldsObjectForContent<T> = Record<
  keyof T,
  FormFieldAttributesForContent
>;

type AnyErrors = Record<string, any>;

export const getFormContents = <T>(
  formFieldsLabels: FormFieldsObjectForContent<T>,
) => ({
  getFormFields: getFormFields(formFieldsLabels),
  getFormErrors: getFormErrors(formFieldsLabels),
});

type FormFieldsKeys<T> = keyof FormFieldsObject<T>;

const defaultField: FormFieldAttributes = {
  label: "field label not set",
  id: "field-id-not-set",
  name: "field-name-not-set",
};

const formatFieldLabel = (field: FormFieldAttributesForContent) =>
  `${field.label}${field.required ? " *" : ""}`;

const getFormErrors =
  <T>(formFieldsLabels: FormFieldsObjectForContent<T>) =>
  () =>
    Object.fromEntries(
      Object.keys(formFieldsLabels).map((key) => [
        key,
        formFieldsLabels[key as FormFieldsKeys<T>]?.label,
      ]),
    );

const getFormFields =
  <T>(formFieldsLabels: FormFieldsObjectForContent<T>) =>
  (): FormFieldsObject<T> =>
    Object.keys(formFieldsLabels).reduce(
      (sum, key) => ({
        ...sum,
        [key]: getFormFieldAttributes(
          key as FormFieldsKeys<T>,
          formFieldsLabels,
        ),
      }),
      formFieldsLabels as FormFieldsObject<T>,
    );

const getFormFieldAttributes = <T>(
  key: FormFieldsKeys<T>,
  formFieldsLabels: FormFieldsObjectForContent<T>,
): FormFieldAttributes => {
  const field = formFieldsLabels[key];
  return {
    ...defaultField,
    ...(field ? field : {}),
    label: field ? formatFieldLabel(field) : defaultField.label,
    name: String(key),
  };
};

export const makeFieldError =
  <Context extends FieldValues>(context: FormState<Context>) =>
  (
    name: keyof Context | DotNestedKeys<Context>,
  ): {
    state: "error" | "default";
    stateRelatedMessage: string | undefined;
  } | null => {
    const error = get(context.errors, name.toString());
    if (isErrorAddressError(error)) {
      return {
        state: "error" as const,
        stateRelatedMessage: `L'adresse fournie semble invalide (${keys(
          error,
        ).join(", ")})`,
      };
    }
    return error
      ? {
          state: "error" as const,
          stateRelatedMessage: getErrorMessage(error),
        }
      : null;
  };

const isErrorAddressError = (error: unknown) => {
  const keysOfAddressSchema: (keyof AddressDto)[] = [
    "postcode",
    "city",
    "departmentCode",
  ];
  return (
    error &&
    typeof error === "object" &&
    keys(error).every((key) => keysOfAddressSchema.includes(key))
  );
};

type RootError = {
  root: {
    message: string;
  };
};

const isRootError = (error: unknown): error is RootError =>
  !!(error && typeof error === "object" && "root" in error);

const getErrorMessage = (error: unknown): string => {
  if (isRootError(error)) {
    return error.root.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return error.message as string;
  }
  return String(error);
};

export const formErrorsToFlatErrors = (obj: AnyErrors): AnyErrors => {
  const errorObj: AnyErrors = {};
  for (const key in obj) {
    if (key in obj) {
      if (typeof obj[key] === "object" && "message" in obj[key]) {
        errorObj[key] = obj[key].message;
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        errorObj[key] = formErrorsToFlatErrors(obj[key]);
      } else {
        errorObj[key] = obj[key];
      }
    }
  }
  return errorObj;
};

const doesSplittedKeyContainsIndex = (splittedKey: string[]) =>
  splittedKey.length > 1 && !Number.isNaN(Number(splittedKey[1]));

const replaceArrayPath = (flatErrorsObject: AnyErrors) =>
  keys(flatErrorsObject).reduce((acc, dotNestedKey) => {
    const separator = ".";
    const keySplitted = dotNestedKey.split(separator);
    const key = doesSplittedKeyContainsIndex(keySplitted)
      ? keySplitted.slice(0, 2).join(separator)
      : dotNestedKey;
    return {
      ...acc,
      [key]: flatErrorsObject[dotNestedKey],
    };
  }, {});

export const displayReadableError = (errors: AnyErrors): AnyErrors =>
  replaceArrayPath(toDotNotation(formErrorsToFlatErrors(errors)));

export const toErrorsWithLabels = ({
  labels,
  errors,
}: {
  labels: Record<string, string>;
  errors: AnyErrors;
}): ErrorNotificationsProps["errorsWithLabels"] =>
  keys(errors).map((error) => ({
    error: {
      field: error,
      message: errors[error],
    },
    label: getErrorLabel(error, labels),
  }));

const getErrorLabel = (
  field: string,
  labels: Record<string, string | undefined>,
) => {
  if (!labels) return field;
  if (field.includes(".") && doesSplittedKeyContainsIndex(field.split("."))) {
    const splittedField = field.split(".");
    const [domain, entryIndex] = splittedField;
    return `${labels[domain]} (${Number.parseInt(entryIndex) + 1})`;
  }
  return labels[field];
};
