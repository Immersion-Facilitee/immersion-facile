import { fr } from "@codegouvfr/react-dsfr";
import { useMemo, useState } from "react";
import {
  RSAutocomplete,
  type RSAutocompleteComponentProps,
  type RSAutocompleteProps,
} from "react-design-system";

import { useDispatch } from "react-redux";
import {
  type AgencyId,
  type AgencyOption,
  activeAgencyStatuses,
  domElementIds,
} from "shared";
import { AgencyStatusBadge } from "src/app/components/agency/AgencyStatusBadge";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { fetchAgencySelectors } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.selectors";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { fetchAgencyOptionsSelectors } from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.selectors";
import { fetchAgencyOptionsSlice } from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.slice";
import { useStyles } from "tss-react/dsfr";

export const useAgencyAdminAutocomplete = () => {
  const dispatch = useDispatch();

  return {
    updateSearchTerm: (searchTerm: string) =>
      dispatch(
        fetchAgencyOptionsSlice.actions.fetchAgencyOptionsRequested(searchTerm),
      ),
    selectOption: (agencyId: AgencyId) => {
      dispatch(
        fetchAgencySlice.actions.fetchAgencyRequested({
          agencyId,
          feedbackTopic: "agency-admin",
        }),
      );
      dispatch(
        connectedUsersAdminSlice.actions.fetchAgencyUsersRequested({
          agencyIds: [agencyId],
        }),
      );
    },
    clearOption: () => dispatch(fetchAgencySlice.actions.clearAgencyAndUsers()),
  };
};

export type AgencyAdminAutocompleteProps = RSAutocompleteComponentProps<
  "agency",
  AgencyOption,
  "agencyAdminAutocomplete"
> & {
  initialValue?: AgencyOption;
};

type AgencyAdminSelectProps = NonNullable<
  RSAutocompleteProps<AgencyOption, "agencyAdminAutocomplete">["selectProps"]
>;

export const AgencyAdminAutocomplete = ({
  label,
  className,
  locator,
  onAgencySelected,
}: AgencyAdminAutocompleteProps): JSX.Element => {
  const isLoading = useAppSelector(fetchAgencyOptionsSelectors.isLoading);
  const agencyOptions = useAppSelector(
    fetchAgencyOptionsSelectors.agencyOptions,
  );
  const selectedAgency = useAppSelector(fetchAgencySelectors.agency);
  const { updateSearchTerm, selectOption, clearOption } =
    useAgencyAdminAutocomplete();
  const [inputValue, setInputValue] = useState("");
  const noOptionText =
    isLoading || !inputValue ? "..." : "Aucune agence trouvée";

  const options = useMemo<AgencyAdminSelectProps["options"]>(
    () =>
      [...agencyOptions]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((option) => ({
          label: option.name,
          value: option,
        })),
    [agencyOptions],
  );
  const { cx } = useStyles();

  return (
    <RSAutocomplete
      locator={locator}
      label={label}
      selectProps={{
        options,
        inputId: domElementIds.admin.agencyTab.editAgencyAutocompleteInput,
        value: selectedAgency?.id
          ? {
              label: selectedAgency.name,
              value: selectedAgency,
            }
          : undefined,
        noOptionsMessage: () => noOptionText,
        isLoading,
        inputValue,
        loadingMessage: () => "Recherche d'agence en cours...",
        placeholder: "Rechercher une agence",
        onChange: (searchResult, actionMeta) => {
          if (
            actionMeta.action === "clear" ||
            actionMeta.action === "remove-value"
          ) {
            clearOption();
            return;
          }
          if (searchResult) {
            updateSearchTerm(searchResult.label);
            selectOption(searchResult.value.id);
            onAgencySelected(searchResult.value);
          }
        },
        onInputChange: (searchTerm, actionMeta) => {
          if (actionMeta.action === "input-change") {
            setInputValue(searchTerm);
            updateSearchTerm(searchTerm);
          }
        },
        components: {
          Option: ({ innerRef, innerProps, data }) => (
            <div
              ref={innerRef}
              {...innerProps}
              className={cx(
                innerProps.className,
                fr.cx("fr-nav__link"),
                "im-select__option",
              )}
            >
              {data.label}
              {!activeAgencyStatuses.includes(data.value.status) && (
                <AgencyStatusBadge status={data.value.status} />
              )}
            </div>
          ),
        },
      }}
      className={className}
    />
  );
};
