import { type RefObject, useEffect, useRef, useState } from "react";
import type { FormFieldKeys } from "src/app/contents/forms/convention/formConvention";
import type { NumberOfSteps } from "src/core-logic/domain/convention/convention.slice";
import type { ConventionEmailValidationRole } from "../ConventionForm";
import { makeConventionStepsInError } from "./errorSummarySections";

const formControlSelector =
  "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])";

const fieldInErrorSelector =
  ".fr-input-group--error, .fr-select-group--error, .fr-fieldset--error";

const expandStepAccordion = (stepElement: HTMLElement): void => {
  const collapse = stepElement.querySelector(".fr-collapse");
  if (collapse?.classList.contains("fr-collapse--expanded")) return;
  stepElement
    .querySelector(".fr-accordion__btn")
    ?.setAttribute("aria-expanded", "true");
};

const focusFirstFieldInError = (stepElement: HTMLElement): void => {
  const firstControlInError = Array.from(
    stepElement.querySelectorAll(fieldInErrorSelector),
  )
    .map((fieldInError) =>
      fieldInError.querySelector<HTMLElement>(formControlSelector),
    )
    .find((control) => control !== null);
  const focusTarget =
    firstControlInError ??
    stepElement.querySelector<HTMLElement>(formControlSelector);
  if (!focusTarget) return;
  focusTarget.scrollIntoView({ block: "center" });
  focusTarget.focus({ preventScroll: true, focusVisible: true });
};

export const useConventionErrorSummary = ({
  submitCount,
  errorPaths,
  rejectedEmailRoles,
  formUiSections,
  openStep,
  getStepElement,
}: {
  submitCount: number;
  errorPaths: string[];
  rejectedEmailRoles: ConventionEmailValidationRole[];
  formUiSections: FormFieldKeys[][];
  openStep: (step: NumberOfSteps, onStepOpened: () => void) => void;
  getStepElement: (step: NumberOfSteps) => HTMLElement | undefined;
}): {
  stepsInError: NumberOfSteps[];
  errorSummaryRef: RefObject<HTMLDivElement>;
  focusErrorSummary: () => void;
  onErrorSummaryStepClick: (step: NumberOfSteps) => void;
} => {
  const [shouldFocusErrorSummary, setShouldFocusErrorSummary] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const stepsInError =
    submitCount > 0
      ? makeConventionStepsInError({
          errorPaths,
          rejectedEmailRoles,
          formUiSections,
        })
      : [];

  useEffect(() => {
    if (!shouldFocusErrorSummary || stepsInError.length === 0) return;
    errorSummaryRef.current?.focus();
    setShouldFocusErrorSummary(false);
  }, [shouldFocusErrorSummary, stepsInError.length]);

  return {
    stepsInError,
    errorSummaryRef,
    focusErrorSummary: () => setShouldFocusErrorSummary(true),
    onErrorSummaryStepClick: (step) => {
      const stepElement = getStepElement(step);
      if (!stepElement) return;
      expandStepAccordion(stepElement);
      openStep(step, () => {
        focusFirstFieldInError(stepElement);
      });
    },
  };
};
