import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import Pagination from "@codegouvfr/react-dsfr/Pagination";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import { equals } from "ramda";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HeadingSection,
  RichDropdown,
  Task,
  useDebounce,
} from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ConventionsWithUnfinalizedAssessmentFilters,
  type ConventionWithUnfinalizedAssessmentReadDto,
  domElementIds,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
  toDisplayedDate,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  getAssessmentCompletionStatus,
  getAssessmentLabelsAndSeverityByStatus,
} from "src/app/utils/assessment.utils";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserConventionsToManageSelectors } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.selectors";
import {
  connectedUserConventionsToManageSlice,
  initialConventionsWithUnfinalizedAssessmentFilters,
} from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.slice";

export const ConventionsWithAssessmentToCompleteList = () => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const conventions = useAppSelector(
    connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessment,
  );
  const pagination = useAppSelector(
    connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentPagination,
  );
  const filters = useAppSelector(
    connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters,
  );

  const areFiltersEmpty = equals(
    filters,
    initialConventionsWithUnfinalizedAssessmentFilters,
  );

  const [tempFilters, setTempFilters] =
    useState<ConventionsWithUnfinalizedAssessmentFilters>(() => ({
      assessmentCompletionStatus: filters.assessmentCompletionStatus,
    }));
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 500);

  useEffect(() => {
    setTempFilters({
      assessmentCompletionStatus: filters.assessmentCompletionStatus,
    });
  }, [filters.assessmentCompletionStatus]);

  const assessmentOptions: RadioButtonsProps["options"] = useMemo(
    () => [
      {
        label: getAssessmentLabelsAndSeverityByStatus({ isPlural: true })[
          "to-complete"
        ].longLabel,
        nativeInputProps: {
          value: "to-complete",
          checked: tempFilters.assessmentCompletionStatus === "to-complete",
          onChange: () => {
            setTempFilters({
              assessmentCompletionStatus: "to-complete",
            });
          },
        },
      },
      {
        label: getAssessmentLabelsAndSeverityByStatus({ isPlural: true })[
          "to-sign"
        ].longLabel,
        nativeInputProps: {
          value: "to-sign",
          checked: tempFilters.assessmentCompletionStatus === "to-sign",
          onChange: () => {
            setTempFilters({
              assessmentCompletionStatus: "to-sign",
            });
          },
        },
      },
    ],
    [tempFilters.assessmentCompletionStatus],
  );

  const onSubmit = useCallback(
    (
      filtersToUse = tempFilters,
      searchQuery: string | undefined = searchValue,
    ) => {
      if (!connectedUserJwt) return;

      const search = searchQuery?.trim() || undefined;

      dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
              ...(filtersToUse.assessmentCompletionStatus && {
                assessmentCompletionStatus:
                  filtersToUse.assessmentCompletionStatus,
              }),
              ...(search && { search }),
            },
            jwt: connectedUserJwt,
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );
    },
    [connectedUserJwt, dispatch, tempFilters, searchValue],
  );

  const searchBarOnSubmitRef = useRef((query: string) => {
    onSubmit(tempFilters, query);
  });

  useEffect(() => {
    searchBarOnSubmitRef.current = (query: string) => {
      onSubmit(tempFilters, query);
    };
  }, [onSubmit, tempFilters]);

  const previousDebouncedSearchValue = useRef(debouncedSearchValue);

  useEffect(() => {
    if (previousDebouncedSearchValue.current === debouncedSearchValue) return;
    previousDebouncedSearchValue.current = debouncedSearchValue;
    searchBarOnSubmitRef.current(debouncedSearchValue);
  }, [debouncedSearchValue]);

  const fetchConventions = useCallback(
    ({ page }: { page: number }) => {
      if (connectedUserJwt) {
        dispatch(
          connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
            {
              filters: {
                ...filters,
                page,
                perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
              },
              jwt: connectedUserJwt,
              feedbackTopic: "conventions-with-unfinalized-assessment",
            },
          ),
        );
      }
    },
    [connectedUserJwt, dispatch, filters],
  );

  const onPaginationClick = useCallback(
    (pageNumber: number) => {
      fetchConventions({ page: pageNumber });
    },
    [fetchConventions],
  );

  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
            },
            jwt: connectedUserJwt,
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );
    }

    return () => {
      dispatch(
        connectedUserConventionsToManageSlice.actions.clearConventionsWithUnfinalizedAssessment(),
      );
    };
  }, [dispatch, connectedUserJwt]);

  const assessmentFilterTagValue = (() => {
    if (tempFilters.assessmentCompletionStatus === "to-sign")
      return `Bilan : ${getAssessmentLabelsAndSeverityByStatus({ isPlural: true })["to-sign"].longLabel}`;
    if (tempFilters.assessmentCompletionStatus === "to-complete")
      return `Bilan : ${getAssessmentLabelsAndSeverityByStatus({ isPlural: true })["to-complete"].longLabel}`;
    return "Tous les bilans";
  })();

  return (
    <HeadingSection
      title="Relances bilans"
      titleAs="h2"
      className={fr.cx("fr-mt-2w", "fr-mb-4w")}
    >
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const query = formData.get("search");
          if (query && typeof query === "string")
            searchBarOnSubmitRef.current(query);
        }}
        className={fr.cx("fr-grid-row", "fr-search-bar", "fr-mb-4w")}
      >
        <div className={fr.cx("fr-col-lg-7")}>
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder:
                "Rechercher une convention (ID, nom, prénom, conseiller, email, SIRET, etc.)",
              role: "search",
              name: "search",
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                setSearchValue(event.target.value);
              },
            }}
            className={fr.cx("fr-mb-0")}
          />
          <span className={fr.cx("fr-hint-text", "fr-mt-1w")}>
            Astuce : saisir un nom de conseiller dans la recherche permet
            d’afficher uniquement ses conventions.
          </span>
        </div>
        <Button type="submit">Rechercher</Button>
      </form>
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit();
        }}
        className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-mb-4w")}
      >
        <RichDropdown
          id="assessment-completion-status"
          iconId="fr-icon-checkbox-line"
          defaultValue="Tous les bilans"
          className={fr.cx("fr-mr-2w")}
          values={[assessmentFilterTagValue]}
          submenu={{
            title: "Filtrer par statut du bilan",
            content: <RadioButtons options={assessmentOptions} />,
          }}
          onReset={() => {
            const newFilters = {
              assessmentCompletionStatus: undefined,
            };
            setTempFilters(newFilters);
            onSubmit(newFilters, searchValue);
          }}
          as="Tag"
        />
      </form>
      {conventions?.length === 0 && (
        <p>
          {!areFiltersEmpty
            ? "Aucun bilan trouvé avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche."
            : "Aucun bilan à compléter ou à signer pour le moment."}
        </p>
      )}
      {conventions.map((convention) => (
        <AssessmentToCompleteTaskItem
          key={convention.id}
          convention={convention}
        />
      ))}
      {pagination &&
        pagination?.totalRecords > NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE && (
          <Pagination
            className={fr.cx("fr-mt-3w")}
            count={pagination.totalPages}
            defaultPage={pagination.currentPage}
            getPageLinkProps={(pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              href: "#",
              key: `page-${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                onPaginationClick(pageNumber);
              },
            })}
          />
        )}
    </HeadingSection>
  );
};

const AssessmentToCompleteTaskItem = ({
  convention,
}: {
  convention: ConventionWithUnfinalizedAssessmentReadDto;
}) => {
  const assessmentCompletionStatus = getAssessmentCompletionStatus(
    convention.assessment,
  );
  const title = (
    <>
      <span className={fr.cx("fr-pr-2v")}>
        {convention.beneficiary.firstname} {
          convention.beneficiary.lastname
        }{" "}
      </span>
      <Badge
        className={fr.cx("fr-badge--error", "fr-mx-2v")}
        severity="warning"
        small
      >
        {
          getAssessmentLabelsAndSeverityByStatus({ isPlural: false })[
            assessmentCompletionStatus
          ].shortLabel.agencyLabel
        }
      </Badge>
    </>
  );
  const formattedAgencyReferent = getFormattedFirstnameAndLastname(
    convention.agencyReferent ?? {},
  );
  const agencyLine = formattedAgencyReferent
    ? `${formattedAgencyReferent} (${convention.agencyName})`
    : convention.agencyName;
  const dateLine = convention.assessment
    ? `Date de complétion du bilan : ${toDisplayedDate({ date: new Date(convention.assessment.createdAt) })}`
    : `Date de fin d'immersion : ${toDisplayedDate({ date: new Date(convention.dateEnd) })}`;
  const footer = (
    <>
      <p className={fr.cx("fr-mb-0")}>{agencyLine}</p>
      <p className={fr.cx("fr-mt-1w", "fr-mb-0")}>{dateLine}</p>
    </>
  );

  return (
    <Task
      title={title}
      titleAs="h3"
      description={
        getAssessmentLabelsAndSeverityByStatus({ isPlural: false })[
          assessmentCompletionStatus
        ].description
      }
      footer={footer}
      buttonsRows={[
        {
          id: domElementIds.manageConventionConnectedUser
            .pilotConventionWithUnfinalizedAssessmentButton,
          content: (
            <Button
              priority="secondary"
              size="medium"
              linkProps={{
                target: "_blank",
                rel: "noreferrer",
                href: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                }).link.href,
              }}
            >
              Piloter
            </Button>
          ),
        },
      ]}
    />
  );
};
