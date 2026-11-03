import { fr } from "@codegouvfr/react-dsfr";
import type { CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import { useState } from "react";
import {
  type AssessmentCompletionStatusFilter,
  assessmentCompletionStatusFilters,
  type ConventionStatus,
  conventionStatuses,
  type DateString,
  isNotEmptyArray,
  type NotEmptyArray,
} from "shared";
import { labelAndSeverityByStatus } from "src/app/contents/convention/labelAndSeverityByStatus";
import { getAssessmentLabelsAndSeverityByStatus } from "src/app/utils/assessment.utils";

type CheckboxFilterParams<T> = {
  selectedValues: T[] | undefined;
  onChange: (selectedValues: NotEmptyArray<T> | undefined) => void;
};

const toggleSelectedValue = <T,>(
  selectedValues: T[] | undefined,
  value: T,
  isChecked: boolean,
): NotEmptyArray<T> | undefined => {
  const values = isChecked
    ? [...(selectedValues ?? []), value]
    : (selectedValues ?? []).filter((selectedValue) => selectedValue !== value);
  return isNotEmptyArray(values) ? values : undefined;
};

export const makeConventionStatusOptions = ({
  selectedValues,
  onChange,
}: CheckboxFilterParams<ConventionStatus>): CheckboxProps["options"] =>
  conventionStatuses.map((status) => ({
    label: labelAndSeverityByStatus[status].label.agency,
    nativeInputProps: {
      value: status,
      checked: selectedValues?.includes(status) ?? false,
      onChange: (event) =>
        onChange(
          toggleSelectedValue(
            selectedValues,
            status,
            event.currentTarget.checked,
          ),
        ),
    },
  }));

export const toAppliedConventionStatusesLabel = (
  statuses: ConventionStatus[] | undefined,
): string => {
  if (!statuses?.length || statuses.length === conventionStatuses.length)
    return "Tous les statuts";
  if (statuses.length > 1) return `Statuts (${statuses.length})`;
  return `Statut : ${labelAndSeverityByStatus[statuses[0]].label.agency}`;
};

const assessmentCompletionStatusFiltersInDisplayOrder: AssessmentCompletionStatusFilter[] =
  ["to-complete", "to-sign", "finalized"];

export const makeAssessmentCompletionStatusOptions = ({
  selectedValues,
  onChange,
}: CheckboxFilterParams<AssessmentCompletionStatusFilter>): CheckboxProps["options"] => {
  const assessmentLabels = getAssessmentLabelsAndSeverityByStatus({
    isPlural: true,
  });
  return assessmentCompletionStatusFiltersInDisplayOrder.map(
    (assessmentCompletionStatus) => ({
      label: assessmentLabels[assessmentCompletionStatus].longLabel,
      ...(assessmentCompletionStatus === "finalized"
        ? { hintText: assessmentLabels.finalized.description }
        : {}),
      nativeInputProps: {
        value: assessmentCompletionStatus,
        checked: selectedValues?.includes(assessmentCompletionStatus) ?? false,
        onChange: (event) =>
          onChange(
            toggleSelectedValue(
              selectedValues,
              assessmentCompletionStatus,
              event.currentTarget.checked,
            ),
          ),
      },
    }),
  );
};

export const toAppliedAssessmentCompletionStatusLabel = (
  assessmentCompletionStatus: AssessmentCompletionStatusFilter[] | undefined,
): string => {
  if (
    !assessmentCompletionStatus?.length ||
    assessmentCompletionStatus.length ===
      assessmentCompletionStatusFilters.length
  )
    return "Tous les bilans";
  if (assessmentCompletionStatus.length > 1)
    return `Bilans (${assessmentCompletionStatus.length})`;
  return `Bilan : ${
    getAssessmentLabelsAndSeverityByStatus({ isPlural: true })[
      assessmentCompletionStatus[0]
    ].longLabel
  }`;
};

type DateDirection = "before" | "after";

const dateDirections: DateDirection[] = ["before", "after"];

export type BeforeOrAfterDateFilterLabels = {
  defaultLabel: string;
  before: string;
  after: string;
};

export type BeforeOrAfterDateFilterValue = {
  from: DateString | undefined;
  to: DateString | undefined;
};

const toBeforeOrAfterDateFilterValue = (
  direction: DateDirection,
  date: DateString,
): BeforeOrAfterDateFilterValue =>
  direction === "before"
    ? { from: undefined, to: date || undefined }
    : { from: date || undefined, to: undefined };

export const toAppliedBeforeOrAfterDateLabel = (
  labels: BeforeOrAfterDateFilterLabels,
  { from, to }: BeforeOrAfterDateFilterValue,
): string => {
  if (from) return `${labels.after} ${from}`;
  if (to) return `${labels.before} ${to}`;
  return labels.defaultLabel;
};

export const BeforeOrAfterDateFilter = ({
  labels,
  value,
  onChange,
}: {
  labels: BeforeOrAfterDateFilterLabels;
  value: BeforeOrAfterDateFilterValue;
  onChange: (value: BeforeOrAfterDateFilterValue) => void;
}): React.ReactNode => {
  const [direction, setDirection] = useState<DateDirection>(
    value.to ? "before" : "after",
  );
  const date = value.from ?? value.to ?? "";

  return (
    <>
      <RadioButtons
        options={dateDirections.map((dateDirection) => ({
          label: labels[dateDirection],
          nativeInputProps: {
            value: dateDirection,
            checked: direction === dateDirection,
            onChange: () => {
              setDirection(dateDirection);
              onChange(toBeforeOrAfterDateFilterValue(dateDirection, date));
            },
          },
        }))}
      />
      <div className={fr.cx("fr-mb-2w")}>
        <Input
          label="Date"
          nativeInputProps={{
            type: "date",
            value: date,
            onChange: (event) =>
              onChange(
                toBeforeOrAfterDateFilterValue(
                  direction,
                  event.currentTarget.value,
                ),
              ),
          }}
        />
      </div>
    </>
  );
};
