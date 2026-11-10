import { Checkbox, type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import type { RichDropdownProps } from "react-design-system";
import {
  type AgencyKind,
  type AgencyStatus,
  agencyStatusToLabel,
  allAgencyStatuses,
  orderedAgencyKindList,
} from "shared";
import {
  type CheckboxDropdownFilterParams,
  type CheckboxFilterParams,
  toggleSelectedValue,
} from "src/app/components/convention/convention-list/conventionListFilters";
import { agencyKindToShortLabel } from "src/app/contents/agencyKind.content";

const allAgencyKindsLabel = "Tous les types";
const allAgencyStatusesLabel = "Tous les statuts";

const makeCheckboxOptions = <T extends string>({
  values,
  labelByValue,
  selectedValues,
  onChange,
}: CheckboxFilterParams<T> & {
  values: readonly T[];
  labelByValue: Record<T, string>;
}): CheckboxProps["options"] =>
  values.map((value) => ({
    label: labelByValue[value],
    nativeInputProps: {
      value,
      checked: selectedValues?.includes(value) ?? false,
      onChange: (event) =>
        onChange(
          toggleSelectedValue(
            selectedValues,
            value,
            event.currentTarget.checked,
          ),
        ),
    },
  }));

const toAppliedAgencyKindsLabel = (kinds: AgencyKind[] | undefined): string => {
  if (!kinds?.length || kinds.length === orderedAgencyKindList.length)
    return allAgencyKindsLabel;
  if (kinds.length > 1) return `Types (${kinds.length})`;
  return `Type : ${agencyKindToShortLabel[kinds[0]]}`;
};

const toAppliedAgencyStatusesLabel = (
  statuses: AgencyStatus[] | undefined,
): string => {
  if (!statuses?.length || statuses.length === allAgencyStatuses.length)
    return allAgencyStatusesLabel;
  if (statuses.length > 1) return `Statuts (${statuses.length})`;
  return `Statut : ${agencyStatusToLabel[statuses[0]]}`;
};

export const makeAgencyKindDropdownFilter = ({
  id,
  appliedValues,
  selectedValues,
  onChange,
  onReset,
}: CheckboxDropdownFilterParams<AgencyKind>): RichDropdownProps => ({
  id,
  iconId: "fr-icon-building-line",
  defaultValue: allAgencyKindsLabel,
  values: [toAppliedAgencyKindsLabel(appliedValues)],
  submenu: {
    title: "Filtrer par type d'agence",
    content: (
      <Checkbox
        options={makeCheckboxOptions({
          values: orderedAgencyKindList,
          labelByValue: agencyKindToShortLabel,
          selectedValues,
          onChange,
        })}
      />
    ),
  },
  onReset,
});

export const makeAgencyStatusDropdownFilter = ({
  id,
  appliedValues,
  selectedValues,
  onChange,
  onReset,
}: CheckboxDropdownFilterParams<AgencyStatus>): RichDropdownProps => ({
  id,
  iconId: "fr-icon-equalizer-line",
  defaultValue: allAgencyStatusesLabel,
  values: [toAppliedAgencyStatusesLabel(appliedValues)],
  submenu: {
    title: "Filtrer par statut",
    content: (
      <Checkbox
        options={makeCheckboxOptions({
          values: allAgencyStatuses,
          labelByValue: agencyStatusToLabel,
          selectedValues,
          onChange,
        })}
      />
    ),
  },
  onReset,
});
