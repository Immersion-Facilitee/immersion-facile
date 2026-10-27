import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Checkbox, type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { type FormEvent, Fragment, useEffect, useState } from "react";
import { HeadingSection, RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AdminConventionListDto,
  adminConventionListMaxResults,
  adminConventionListTextFilterMinLength,
  agencyKindToLabelIncludingIFAndPrepa,
  type ConventionStatus,
  conventionStatuses,
  defaultPerPageInWebPagination,
  domElementIds,
  type FlatGetConventionsForAdminParams,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  isNotEmptyArray,
  siretRegex,
  toDisplayedDate,
} from "shared";
import { ConventionDatesDisplay } from "src/app/components/convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "src/app/components/convention/ConventionStatusBadge";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { labelAndSeverityByStatus } from "src/app/contents/convention/labelAndSeverityByStatus";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import logoFtSvg from "src/assets/img/logo-ft.svg";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  conventionListSlice,
  initialAdminConventionList,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { TruncatedIdCell } from "./TruncatedIdCell";

type TextFilterName = keyof Pick<
  FlatGetConventionsForAdminParams,
  | "agencyNameContains"
  | "beneficiaryEmail"
  | "beneficiaryNameContains"
  | "beneficiaryRepresentativeEmail"
  | "establishmentTutorEmail"
  | "establishmentRepresentativeEmail"
  | "businessNameContains"
  | "siret"
>;

type DateFilterName = keyof Pick<
  FlatGetConventionsForAdminParams,
  "dateStartFrom" | "dateStartTo" | "dateValidationFrom" | "dateValidationTo"
>;

type FilterName = TextFilterName | DateFilterName;

type FilterFormValues = Record<FilterName, string> & {
  statuses: ConventionStatus[];
};

type FilterField = {
  name: FilterName;
  label: string;
  type: "text" | "email" | "date";
  hintText?: string;
  minLength?: number;
  pattern?: string;
};

const feedbackTopic: FeedbackTopic = "admin-convention-list";

const textContainsFilterConstraint: Pick<
  FilterField,
  "hintText" | "minLength" | "pattern"
> = {
  hintText: `${adminConventionListTextFilterMinLength} caractères minimum`,
  minLength: adminConventionListTextFilterMinLength,
  pattern: `\\s*\\S.{${adminConventionListTextFilterMinLength - 2},}\\S\\s*`,
};

const filterFields: FilterField[] = [
  {
    name: "agencyNameContains",
    label: "Agence",
    type: "text",
    ...textContainsFilterConstraint,
  },
  { name: "beneficiaryEmail", label: "Email Bénéficiaire", type: "email" },
  {
    name: "beneficiaryNameContains",
    label: "Nom bénéficiaire",
    type: "text",
    ...textContainsFilterConstraint,
  },
  {
    name: "beneficiaryRepresentativeEmail",
    label: "Email Rep. Légal du bénéficiaire",
    type: "email",
  },
  { name: "establishmentTutorEmail", label: "Email Tuteur", type: "email" },
  {
    name: "establishmentRepresentativeEmail",
    label: "Email Représentant de l'entreprise",
    type: "email",
  },
  {
    name: "businessNameContains",
    label: "Entreprise",
    type: "text",
    ...textContainsFilterConstraint,
  },
  {
    name: "siret",
    label: "SIRET",
    hintText: "14 chiffres",
    type: "text",
    pattern: siretRegex.source,
  },
  {
    name: "dateStartFrom",
    label: "Date de début de l'immersion",
    hintText: "À partir du",
    type: "date",
  },
  {
    name: "dateStartTo",
    label: "Date de début de l'immersion",
    hintText: "Jusqu'au",
    type: "date",
  },
  {
    name: "dateValidationFrom",
    label: "Date de validation",
    hintText: "À partir du",
    type: "date",
  },
  {
    name: "dateValidationTo",
    label: "Date de validation",
    hintText: "Jusqu'au",
    type: "date",
  },
];

const emptyFilterFormValues: FilterFormValues = {
  statuses: [],
  agencyNameContains: "",
  beneficiaryEmail: "",
  beneficiaryNameContains: "",
  beneficiaryRepresentativeEmail: "",
  establishmentTutorEmail: "",
  establishmentRepresentativeEmail: "",
  businessNameContains: "",
  siret: "",
  dateStartFrom: "",
  dateStartTo: "",
  dateValidationFrom: "",
  dateValidationTo: "",
};

const toResultCountLabel = (totalRecords: number): string => {
  if (totalRecords >= adminConventionListMaxResults)
    return `${adminConventionListMaxResults} conventions ou plus : seules les ${adminConventionListMaxResults} plus récentes sont consultables, affinez les filtres pour trouver les plus anciennes.`;
  if (totalRecords <= 1) return `${totalRecords} convention`;
  return `${totalRecords} conventions`;
};

export const AdminConventionListSection = (): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const isLoading = useAppSelector(conventionListSelectors.isLoading);
  const {
    data: conventions,
    pagination,
    filters,
  } = useAppSelector(conventionListSelectors.adminConventionList);
  const [filterFormValues, setFilterFormValues] = useState<FilterFormValues>(
    emptyFilterFormValues,
  );

  useEffect(() => {
    if (connectedUserJwt)
      dispatch(
        conventionListSlice.actions.fetchAdminConventionListRequested({
          jwt: connectedUserJwt,
          filters: initialAdminConventionList.filters,
          feedbackTopic,
        }),
      );

    return () => {
      dispatch(conventionListSlice.actions.clearAdminConventionListRequested());
    };
  }, [dispatch, connectedUserJwt]);

  if (!connectedUserJwt) return null;

  const fetchConventions = (
    filtersToFetch: FlatGetConventionsForAdminParams,
  ): void => {
    dispatch(feedbackSlice.actions.clearFeedbackTopics([feedbackTopic]));
    dispatch(
      conventionListSlice.actions.fetchAdminConventionListRequested({
        jwt: connectedUserJwt,
        filters: filtersToFetch,
        feedbackTopic,
      }),
    );
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    fetchConventions(toFlatGetConventionsForAdminParams(filterFormValues));
  };

  const onReset = (): void => {
    setFilterFormValues(emptyFilterFormValues);
    fetchConventions(initialAdminConventionList.filters);
  };

  const statusOptions: CheckboxProps["options"] = conventionStatuses.map(
    (status) => ({
      label: labelAndSeverityByStatus[status].label.agency,
      nativeInputProps: {
        id: `${domElementIds.adminConventions.conventionListStatusCheckbox}--${status}`,
        value: status,
        checked: filterFormValues.statuses.includes(status),
        onChange: (event) =>
          setFilterFormValues({
            ...filterFormValues,
            statuses: event.currentTarget.checked
              ? [...filterFormValues.statuses, status]
              : filterFormValues.statuses.filter(
                  (selectedStatus) => selectedStatus !== status,
                ),
          }),
      },
    }),
  );

  return (
    <HeadingSection
      title="Consulter les conventions"
      description={`Conventions correspondant aux filtres, de la plus récente à la plus ancienne date de la demande. Cliquer sur l'identifiant de la convention pour y accéder.`}
    >
      <form onSubmit={onSubmit}>
        <Checkbox
          legend="Statut"
          orientation="horizontal"
          small
          options={statusOptions}
        />
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          {filterFields.map(
            ({ name, label, hintText, type, minLength, pattern }) => (
              <div key={name} className={fr.cx("fr-col-12", "fr-col-md-4")}>
                <Input
                  label={label}
                  hintText={hintText}
                  nativeInputProps={{
                    id: `${domElementIds.adminConventions.conventionListFilterInput}--${name}`,
                    name,
                    type,
                    minLength,
                    pattern,
                    value: filterFormValues[name],
                    onChange: (event) =>
                      setFilterFormValues({
                        ...filterFormValues,
                        [name]: event.currentTarget.value,
                      }),
                  }}
                />
              </div>
            ),
          )}
        </div>
        <div className={fr.cx("fr-btns-group", "fr-btns-group--inline-md")}>
          <Button
            type="submit"
            id={domElementIds.adminConventions.conventionListSubmitButton}
            disabled={isLoading}
          >
            Rechercher
          </Button>
          <Button
            type="button"
            priority="secondary"
            id={domElementIds.adminConventions.conventionListResetButton}
            disabled={isLoading}
            onClick={onReset}
          >
            Réinitialiser les filtres
          </Button>
        </div>
      </form>
      <WithFeedbackReplacer topic={feedbackTopic}>
        <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
          {toResultCountLabel(pagination.totalRecords)}
        </p>
        <div id={domElementIds.adminConventions.conventionListTable}>
          <RichTable
            label="Liste des conventions"
            hasViewSwitch={false}
            isLoading={isLoading}
            headers={
              conventions.length > 0
                ? [
                    "Email Conseiller France Travail lié (FT connect)",
                    "id",
                    "Id de brouillon",
                    "Structure",
                    "Structure d'accompagnement liée",
                    "Type de structure",
                    "Département de la structure",
                    "Date de la demande",
                    "Statut",
                    "Bénéficiaire",
                    "Entreprise",
                    "Métier",
                    "Dates de l'immersion",
                  ]
                : ["Aucune convention trouvée avec ces filtres."]
            }
            tableData={conventions.map(makeAdminConventionListLine)}
            pagination={{
              count: pagination.totalPages,
              defaultPage: pagination.currentPage,
              showFirstLast: true,
              getPageLinkProps: (pageNumber) => ({
                title: `Résultats de recherche, page : ${pageNumber}`,
                onClick: (event) => {
                  event.preventDefault();
                  fetchConventions({ ...filters, page: pageNumber });
                },
                href: "#",
                key: `pagination-link-${pageNumber}`,
              }),
            }}
          />
        </div>
      </WithFeedbackReplacer>
    </HeadingSection>
  );
};

const toFlatGetConventionsForAdminParams = (
  filterFormValues: FilterFormValues,
): FlatGetConventionsForAdminParams => ({
  ...(isNotEmptyArray(filterFormValues.statuses)
    ? { statuses: filterFormValues.statuses }
    : {}),
  agencyNameContains: toOptionalFilter(filterFormValues.agencyNameContains),
  beneficiaryEmail: toOptionalFilter(filterFormValues.beneficiaryEmail),
  beneficiaryNameContains: toOptionalFilter(
    filterFormValues.beneficiaryNameContains,
  ),
  beneficiaryRepresentativeEmail: toOptionalFilter(
    filterFormValues.beneficiaryRepresentativeEmail,
  ),
  establishmentTutorEmail: toOptionalFilter(
    filterFormValues.establishmentTutorEmail,
  ),
  establishmentRepresentativeEmail: toOptionalFilter(
    filterFormValues.establishmentRepresentativeEmail,
  ),
  businessNameContains: toOptionalFilter(filterFormValues.businessNameContains),
  siret: toOptionalFilter(filterFormValues.siret),
  dateStartFrom: toOptionalFilter(filterFormValues.dateStartFrom),
  dateStartTo: toOptionalFilter(filterFormValues.dateStartTo),
  dateValidationFrom: toOptionalFilter(filterFormValues.dateValidationFrom),
  dateValidationTo: toOptionalFilter(filterFormValues.dateValidationTo),
  page: 1,
  perPage: defaultPerPageInWebPagination,
});

const toOptionalFilter = (value: string): string | undefined =>
  value.trim() || undefined;

const makeAdminConventionListLine = (
  convention: AdminConventionListDto,
): React.ReactNode[] => {
  const ftConnectAdvisor =
    convention.beneficiary.federatedIdentity?.payload?.advisor;

  return [
    ftConnectAdvisor ? (
      <Fragment key={`${convention.id}-ft-connect-advisor`}>
        {ftConnectAdvisor.email}
        <p className={fr.cx("fr-text--xs", "fr-mb-0")}>
          {getFormattedFirstnameAndLastname({
            firstname: ftConnectAdvisor.firstName,
            lastname: ftConnectAdvisor.lastName,
          })}
        </p>
      </Fragment>
    ) : (
      ""
    ),
    <TruncatedIdCell
      key={`${convention.id}-id`}
      id={convention.id}
      copyButtonId={`${domElementIds.adminConventions.conventionListCopyConventionIdButton}--${convention.id}`}
      link={{
        ...frontRoutes.adminConventionDetail({ conventionId: convention.id })
          .link,
        id: `${domElementIds.adminConventions.conventionListConventionLink}--${convention.id}`,
      }}
    />,
    convention.sourceConventionDraftId ? (
      <TruncatedIdCell
        key={`${convention.id}-draft-id`}
        id={convention.sourceConventionDraftId}
        copyButtonId={`${domElementIds.adminConventions.conventionListCopyDraftIdButton}--${convention.id}`}
      />
    ) : (
      ""
    ),
    convention.agency.name,
    convention.agency.refersToAgencyName ?? "",
    agencyKindToLabelIncludingIFAndPrepa[convention.agency.kind],
    convention.agency.departmentName ?? "",
    toDisplayedDate({ date: new Date(convention.dateSubmission) }),
    <ConventionStatusBadge
      key={`${convention.id}-status`}
      conventionStatus={convention.status}
      userKind="agency"
    />,
    <Fragment key={`${convention.id}-beneficiary`}>
      <strong>
        {getFormattedFirstnameAndLastname({
          firstname: convention.beneficiary.firstName,
          lastname: convention.beneficiary.lastName,
        })}
      </strong>
      {convention.beneficiary.federatedIdentity && (
        <div className={fr.cx("fr-mt-1w")}>
          <img
            src={logoFtSvg}
            alt=""
            aria-hidden="true"
            className={fr.cx("fr-icon--sm", "fr-mr-1w")}
          />
          <strong className={fr.cx("fr-text--sm", "fr-label--info")}>
            FT Connect
          </strong>
        </div>
      )}
    </Fragment>,
    <Fragment key={`${convention.id}-business`}>
      <strong>{convention.businessName}</strong>
      <br />
      {convention.siret}
    </Fragment>,
    convention.immersionAppellation.appellationLabel,
    <ConventionDatesDisplay
      key={`${convention.id}-dates`}
      dateStart={convention.dateStart}
      dateEnd={convention.dateEnd}
    />,
  ];
};
