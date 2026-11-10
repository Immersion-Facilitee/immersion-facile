import { type RefObject, useEffect, useRef, useState } from "react";
import type { FormConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import {
  type ConventionEmailValidationRole,
  type ConventionErrorSummarySection,
  makeConventionErrorSummary,
} from "./errorSummarySections";

const formControlSelector =
  "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])";

const focusConventionFormField = (fieldId: string): void => {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const focusTarget = field.matches(formControlSelector)
    ? field
    : (field.querySelector<HTMLElement>(formControlSelector) ?? field);
  focusTarget.scrollIntoView({ block: "center" });
  focusTarget.focus({ preventScroll: true, focusVisible: true });
};

export const useConventionErrorSummary = ({
  submitCount,
  errorPaths,
  rejectedEmailRoles,
  canSelectAgency,
  fieldsLabels,
  openStep,
}: {
  submitCount: number;
  errorPaths: string[];
  rejectedEmailRoles: ConventionEmailValidationRole[];
  canSelectAgency: boolean;
  fieldsLabels: FormConventionFieldsLabels;
  openStep: (step: NumberOfSteps, onStepOpened: () => void) => void;
}): {
  errorSummarySections: ConventionErrorSummarySection[];
  errorSummaryRef: RefObject<HTMLDivElement>;
  focusErrorSummary: () => void;
  onErrorSummarySectionClick: (section: ConventionErrorSummarySection) => void;
} => {
  const [shouldFocusErrorSummary, setShouldFocusErrorSummary] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const errorSummarySections =
    submitCount > 0
      ? makeConventionErrorSummary({
          errorPaths,
          rejectedEmailRoles,
          canSelectAgency,
          fieldsLabels,
        })
      : [];

  useEffect(() => {
    if (!shouldFocusErrorSummary || errorSummarySections.length === 0) return;
    errorSummaryRef.current?.focus();
    setShouldFocusErrorSummary(false);
  }, [shouldFocusErrorSummary, errorSummarySections.length]);

  return {
    errorSummarySections,
    errorSummaryRef,
    focusErrorSummary: () => setShouldFocusErrorSummary(true),
    onErrorSummarySectionClick: (section) =>
      openStep(section.step, () => {
        focusConventionFormField(section.firstFieldId);
      }),
  };
};
