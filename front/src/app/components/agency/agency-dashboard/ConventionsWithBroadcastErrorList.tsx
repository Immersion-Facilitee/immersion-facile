import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import { Checkbox, type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
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
  activeAgencyStatuses,
  conventionStatuses,
  domElementIds,
  type FlatGetConventionsWithErroredBroadcastFeedbackParams,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  isFunctionalBroadcastFeedbackError,
  NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
} from "shared";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { getBroadcastFeedbackDescription } from "src/app/contents/broadcast-feedback/broadcastFeedback";
import { labelAndSeverityByStatus } from "src/app/contents/convention/labelAndSeverityByStatus";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionsWithBroadcastFeedbackSelectors } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.selectors";
import {
  conventionsWithBroadcastFeedbackSlice,
  initialConventionsWithPagination,
} from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.slice";
import { useStyles } from "tss-react/dsfr";

export const ConventionsWithBroadcastErrorList = ({
  title,
}: {
  title: string;
}) => {
  const dispatch = useDispatch();
  const { cx } = useStyles();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const {
    data: conventionsWithBroadcastFeedback,
    pagination,
    filters,
  } = useAppSelector(
    conventionsWithBroadcastFeedbackSelectors.erroredBroadcastConventionsWithPagination,
  );
  const areFiltersEmpty = equals(
    filters,
    initialConventionsWithPagination.filters,
  );

  const [tempFilters, setTempFilters] = useState<
    Pick<
      FlatGetConventionsWithErroredBroadcastFeedbackParams,
      "broadcastErrorKind" | "conventionStatus" | "search"
    >
  >(() => ({
    broadcastErrorKind: filters.broadcastErrorKind,
    conventionStatus: filters.conventionStatus,
    search: filters.search,
  }));

  useEffect(() => {
    setTempFilters({
      broadcastErrorKind: filters.broadcastErrorKind,
      conventionStatus: filters.conventionStatus,
      search: filters.search,
    });
  }, [filters.broadcastErrorKind, filters.conventionStatus, filters.search]);

  const broadcastErrorKindOptions: RadioButtonsProps["options"] = useMemo(
    () => [
      {
        label: "Erreurs fonctionnelles",
        nativeInputProps: {
          value: "functional",
          checked: tempFilters.broadcastErrorKind === "functional",
          onChange: () => {
            setTempFilters((prev) => ({
              ...prev,
              broadcastErrorKind: "functional",
            }));
          },
        },
      },
      {
        label: "Erreurs techniques",
        nativeInputProps: {
          value: "technical",
          checked: tempFilters.broadcastErrorKind === "technical",
          onChange: () => {
            setTempFilters((prev) => ({
              ...prev,
              broadcastErrorKind: "technical",
            }));
          },
        },
      },
    ],
    [tempFilters.broadcastErrorKind],
  );

  const statusOptions: CheckboxProps["options"] = useMemo(() => {
    return conventionStatuses.map((status) => ({
      label: labelAndSeverityByStatus[status].label.agency,
      nativeInputProps: {
        value: status,
        checked: tempFilters.conventionStatus?.includes(status) ?? false,
        onChange: () => {
          setTempFilters((prev) => {
            const currentStatuses = prev.conventionStatus ?? [];
            const newStatuses = currentStatuses.includes(status)
              ? currentStatuses.filter((s) => s !== status)
              : [...currentStatuses, status];
            return {
              ...prev,
              conventionStatus:
                newStatuses.length > 0 ? newStatuses : undefined,
            };
          });
        },
      },
    }));
  }, [tempFilters.conventionStatus]);

  const onSubmit = useCallback(
    (filtersToUse = tempFilters, searchQuery?: string) => {
      if (!connectedUserJwt) return;

      dispatch(
        conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
          {
            filters: {
              ...filters,
              ...filtersToUse,
              search: searchQuery || undefined,
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
            },
            jwt: connectedUserJwt,
            feedbackTopic: "conventions-with-broadcast-feedback",
          },
        ),
      );
    },
    [connectedUserJwt, dispatch, filters, tempFilters],
  );

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 500);
  const searchBarOnSubmitRef = useRef((query: string) => {
    onSubmit(tempFilters, query);
  });

  useEffect(() => {
    searchBarOnSubmitRef.current = (query: string) => {
      onSubmit(tempFilters, query);
    };
  }, [onSubmit, tempFilters]);

  useEffect(() => {
    searchBarOnSubmitRef.current(debouncedSearchValue);
  }, [debouncedSearchValue]);

  const getConventionsWithErroredBroadcastFeedbackRequested = useCallback(
    (page: number) => {
      if (connectedUserJwt) {
        dispatch(
          conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
            {
              filters: {
                ...filters,
                page,
                perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
              },
              jwt: connectedUserJwt,
              feedbackTopic: "conventions-with-broadcast-feedback",
            },
          ),
        );
      }
    },
    [connectedUserJwt, dispatch, filters],
  );

  const onPaginationClick = useCallback(
    (pageNumber: number) => {
      getConventionsWithErroredBroadcastFeedbackRequested(pageNumber);
    },
    [getConventionsWithErroredBroadcastFeedbackRequested],
  );

  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
          {
            filters: {
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
              broadcastErrorKind: "functional",
            },
            jwt: connectedUserJwt,
            feedbackTopic: "conventions-with-broadcast-feedback",
          },
        ),
      );
    }

    return () => {
      dispatch(
        conventionsWithBroadcastFeedbackSlice.actions.clearConventionsWithBroadcastFeedbackFilters(),
      );
    };
  }, [dispatch, connectedUserJwt]);

  const isFtUser = currentUser?.agencyRights.some(
    (agencyRight) =>
      agencyRight.agency.kind === "france-travail" &&
      activeAgencyStatuses.includes(agencyRight.agency.status),
  );

  const isMiloUser = currentUser?.agencyRights.some(
    (agencyRight) =>
      agencyRight.agency.kind === "mission-locale" &&
      activeAgencyStatuses.includes(agencyRight.agency.status),
  );

  const erroredConventionsDashboardUrl =
    currentUser?.dashboards.agencies.erroredConventionsDashboardUrl;

  return (
    <HeadingSection
      title={title}
      titleAs="h2"
      className={fr.cx("fr-mt-2w", "fr-mb-4w")}
      titleAction={
        (isFtUser || isMiloUser) && (
          <Button
            priority="secondary"
            linkProps={{
              href: isFtUser
                ? "https://poleemploi.sharepoint.com/:p:/r/sites/NAT-Mediatheque-Appropriation/Documents/Immersion_facilitee/Immersion_facilitee/Guide_de_gestion_des_conventions_en_erreur.pptx?d=w489a3c6b6e5148e6bea287ddfadba8c7&csf=1&web=1&e=i1GD5H"
                : "https://docs.google.com/presentation/d/14iN1tBOznkwYka-x-ZHmD-Msy5fE2dYqC3Yc1zfxw8A/edit?slide=id.g3bedc2e4d54_2_0#slide=id.g3bedc2e4d54_2_0",
              target: "_blank",
              rel: "noreferrer",
            }}
          >
            Guide de gestion des conventions en erreur
          </Button>
        )
      }
    >
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const query = formData.get("search");
          if (query && typeof query === "string") {
            searchBarOnSubmitRef.current(query);
          }
        }}
        className={fr.cx("fr-grid-row", "fr-search-bar", "fr-mb-4w")}
      >
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
          className={fr.cx("fr-mb-0", "fr-col-lg-7")}
        />
        <Button type="submit">Rechercher</Button>
      </form>
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit();
        }}
        className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-mb-4w")}
      >
        <div className={fr.cx("fr-col")}>
          <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
            <RichDropdown
              id="broadcast-error-kind"
              iconId="fr-icon-error-warning-line"
              defaultValue="Tous les types d'erreurs"
              className={fr.cx("fr-mr-2w")}
              values={[
                tempFilters.broadcastErrorKind === "functional"
                  ? "Type : Erreurs fonctionnelles"
                  : tempFilters.broadcastErrorKind === "technical"
                    ? "Type : Erreurs techniques"
                    : "Tous les types d'erreurs",
              ]}
              submenu={{
                title: "Filtrer par type d'erreur",
                content: <RadioButtons options={broadcastErrorKindOptions} />,
              }}
              onReset={() => {
                const newFilters = {
                  ...tempFilters,
                  broadcastErrorKind: undefined,
                };
                setTempFilters(newFilters);
                onSubmit(newFilters, searchValue || undefined);
              }}
              as="Tag"
            />
            <RichDropdown
              id="convention-status"
              iconId="fr-icon-equalizer-line"
              className={fr.cx("fr-mr-2w")}
              defaultValue="Tous les statuts"
              values={
                filters.conventionStatus?.length &&
                filters.conventionStatus.length !== conventionStatuses.length
                  ? [
                      `${
                        filters.conventionStatus.length > 1
                          ? "Statuts"
                          : "Statut :"
                      }  ${
                        filters.conventionStatus.length > 1
                          ? `(${filters.conventionStatus.length})`
                          : filters.conventionStatus
                              .map(
                                (status) =>
                                  labelAndSeverityByStatus[status].label.agency,
                              )
                              .join(", ")
                      }`,
                    ]
                  : ["Tous les statuts"]
              }
              submenu={{
                title: "Filtrer par statut",
                content: <Checkbox options={statusOptions} />,
              }}
              onReset={() => {
                const newFilters = {
                  ...tempFilters,
                  conventionStatus: undefined,
                };
                setTempFilters(newFilters);
                onSubmit(newFilters, searchValue || undefined);
              }}
              as="Tag"
            />
          </div>
        </div>
        {erroredConventionsDashboardUrl && (
          <div className={fr.cx("fr-ml-auto", "fr-col--middle")}>
            <MetabaseFullScreenButton
              url={erroredConventionsDashboardUrl}
              label="Télécharger les données (Excel/CSV)"
              tooltipText="L'export se fait depuis l'ancien tableau Metabase."
            />
          </div>
        )}
      </form>
      {conventionsWithBroadcastFeedback.length === 0 && (
        <p>
          {areFiltersEmpty
            ? "Aucune convention à traiter en erreur de diffusion."
            : "Aucune convention trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche."}
        </p>
      )}
      {conventionsWithBroadcastFeedback.map(
        (conventionWithBroadcastFeedback) => (
          <Task
            key={conventionWithBroadcastFeedback.id}
            titleAs="h3"
            title={
              <>
                <span>
                  {getFormattedFirstnameAndLastname({
                    firstname:
                      conventionWithBroadcastFeedback.beneficiary.firstname,
                    lastname:
                      conventionWithBroadcastFeedback.beneficiary.lastname,
                  })}
                </span>
                <Badge className={fr.cx("fr-badge--error", "fr-mx-2v")} small>
                  <i
                    className={fr.cx(
                      "fr-icon-error-fill",
                      "fr-icon--sm",
                      "fr-mr-1v",
                    )}
                  />
                  {isFunctionalBroadcastFeedbackError(
                    conventionWithBroadcastFeedback.lastBroadcastFeedback
                      ?.subscriberErrorFeedback?.message ?? "",
                  )
                    ? "Erreur fonctionnelle"
                    : "Erreur technique"}
                </Badge>
                <Badge
                  className={cx(
                    fr.cx("fr-mx-2v"),
                    labelAndSeverityByStatus[
                      conventionWithBroadcastFeedback.status
                    ].color,
                  )}
                  small
                >
                  {
                    labelAndSeverityByStatus[
                      conventionWithBroadcastFeedback.status
                    ].label.agency
                  }
                </Badge>
              </>
            }
            description={getBroadcastFeedbackDescription(
              conventionWithBroadcastFeedback.lastBroadcastFeedback
                ?.subscriberErrorFeedback?.message ?? "",
            )}
            buttonsRows={[
              {
                id: domElementIds.manageConventionConnectedUser
                  .pilotConventionWithBroadcastErrorButton,
                content: (
                  <Button
                    key={
                      domElementIds.manageConventionConnectedUser
                        .pilotConventionWithBroadcastErrorButton
                    }
                    priority="secondary"
                    size="medium"
                    linkProps={{
                      target: "_blank",
                      rel: "noreferrer",
                      href: frontRoutes.manageConventionConnectedUser({
                        conventionId: conventionWithBroadcastFeedback.id,
                      }).link.href,
                    }}
                  >
                    Piloter
                  </Button>
                ),
              },
            ]}
          />
        ),
      )}
      {pagination.totalRecords > NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE && (
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
