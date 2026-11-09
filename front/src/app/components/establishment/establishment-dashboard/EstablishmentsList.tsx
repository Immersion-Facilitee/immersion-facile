import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { type ReactNode, useState } from "react";
import {
  CopyButton,
  RichTable,
  type TableSortDirection,
} from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type AcceptedUserEstablishmentRightDetails,
  domElementIds,
  type Email,
  frontRoutes,
  getDisplayedBusinessName,
  onlyAdminUserRightsWithStatusAccepted,
  toLowerCaseWithoutDiacritics,
} from "shared";
import { establishmentRolesToDisplay } from "src/app/contents/userRolesToDisplay";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";

const maxAdminsDisplayedInTable = 3;

type SortColumn = "businessName" | "role";

type SortState = {
  column: SortColumn;
  direction: Exclude<TableSortDirection, false>;
};

const adminsListModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.establishmentDashboard.manageEstablishments.adminsListModal,
});

type EstablishmentsListProps = {
  establishments: AcceptedUserEstablishmentRightDetails[];
  currentUserEmail: Email;
  isBackofficeAdmin: boolean | undefined;
  shouldUpdateAvailability: string | undefined;
};

export const EstablishmentsList = ({
  establishments,
  currentUserEmail,
  isBackofficeAdmin,
  shouldUpdateAvailability,
}: EstablishmentsListProps): ReactNode => {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortState>({
    column: "businessName",
    direction: "asc",
  });
  const [
    establishmentWithAdminsDisplayed,
    setEstablishmentWithAdminsDisplayed,
  ] = useState<AcceptedUserEstablishmentRightDetails | null>(null);

  const onSortClick = (column: SortColumn) => {
    setSort((current) => {
      if (current.column !== column) {
        return { column, direction: "asc" };
      }

      return {
        column,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const sortDirectionFor = (column: SortColumn): TableSortDirection =>
    sort.column === column ? sort.direction : false;

  const displayedEstablishments = establishments
    .filter((establishment) =>
      isEstablishmentMatchingSearchQuery(establishment, searchQuery),
    )
    .sort((a, b) => compareEstablishments(a, b, sort));

  const onManageEstablishmentClicked = (): void => {
    dispatch(establishmentSlice.actions.clearEstablishmentRequested());
    dispatch(siretSlice.actions.siretInfoClearRequested());
    dispatch(
      geocodingSlice.actions.clearLocatorDataRequested({
        locator: "create-establishment-in-person-address",
      }),
    );
  };

  const onShowAllAdminsClicked = (
    establishment: AcceptedUserEstablishmentRightDetails,
  ): void => {
    setEstablishmentWithAdminsDisplayed(establishment);
    adminsListModal.open();
  };

  return (
    <>
      <RichTable
        label="Mes entreprises"
        isLoading={false}
        hasViewSwitch={false}
        searchBar={{
          label: "Rechercher une entreprise",
          placeholder: "Nom d’enseigne, raison sociale ou SIRET",
          onSubmit: setSearchQuery,
        }}
        headers={
          displayedEstablishments.length > 0
            ? [
                {
                  content: "Entreprise",
                  sort: {
                    direction: sortDirectionFor("businessName"),
                    onClick: () => onSortClick("businessName"),
                  },
                },
                {
                  content: "Mon rôle",
                  sort: {
                    direction: sortDirectionFor("role"),
                    onClick: () => onSortClick("role"),
                  },
                },
                { content: "Administrateurs" },
                { content: "Actions" },
              ]
            : [
                {
                  content: `Aucune entreprise trouvée pour la recherche « ${searchQuery} », vous pouvez modifier votre recherche pour l'élargir.`,
                },
              ]
        }
        tableData={displayedEstablishments.map((establishment) => [
          <EstablishmentNameAndSiret
            key={`${establishment.siret}-name`}
            establishment={establishment}
          />,
          <EstablishmentRole
            key={`${establishment.siret}-role`}
            establishment={establishment}
          />,
          <EstablishmentAdmins
            key={`${establishment.siret}-admins`}
            establishment={establishment}
            currentUserEmail={currentUserEmail}
            onShowAllAdminsClicked={onShowAllAdminsClicked}
          />,
          <EstablishmentActions
            key={`${establishment.siret}-actions`}
            establishment={establishment}
            isBackofficeAdmin={isBackofficeAdmin}
            shouldUpdateAvailability={shouldUpdateAvailability}
            onManageEstablishmentClicked={onManageEstablishmentClicked}
          />,
        ])}
      />
      {createPortal(
        <adminsListModal.Component
          title={`Administrateurs (${establishmentWithAdminsDisplayed?.admins.length ?? 0})`}
          buttons={[
            {
              id: domElementIds.establishmentDashboard.manageEstablishments
                .adminsListModalCloseButton,
              children: "Fermer",
            },
          ]}
        >
          {establishmentWithAdminsDisplayed && (
            <AdminsListModalContent
              establishment={establishmentWithAdminsDisplayed}
              currentUserEmail={currentUserEmail}
            />
          )}
        </adminsListModal.Component>,
        document.body,
      )}
    </>
  );
};

const compareEstablishments = (
  a: AcceptedUserEstablishmentRightDetails,
  b: AcceptedUserEstablishmentRightDetails,
  sort: SortState,
) => {
  const result =
    sort.column === "businessName"
      ? getDisplayedBusinessName(a).localeCompare(getDisplayedBusinessName(b))
      : establishmentRolesToDisplay[a.role].label.localeCompare(
          establishmentRolesToDisplay[b.role].label,
        );

  return sort.direction === "asc" ? result : -result;
};

const isEstablishmentMatchingSearchQuery = (
  establishment: AcceptedUserEstablishmentRightDetails,
  searchQuery: string,
): boolean => {
  const normalizedSearchQuery = toLowerCaseWithoutDiacritics(
    searchQuery.trim(),
  );
  if (!normalizedSearchQuery) return true;

  return (
    toLowerCaseWithoutDiacritics(establishment.businessName).includes(
      normalizedSearchQuery,
    ) ||
    toLowerCaseWithoutDiacritics(
      establishment.businessNameCustomized ?? "",
    ).includes(normalizedSearchQuery) ||
    establishment.siret.includes(normalizedSearchQuery.replaceAll(" ", ""))
  );
};

const EstablishmentNameAndSiret = ({
  establishment,
}: {
  establishment: AcceptedUserEstablishmentRightDetails;
}): ReactNode => {
  const displayedBusinessName = getDisplayedBusinessName(establishment);
  const siretLabel = `SIRET ${establishment.siret}`;

  return (
    <>
      <p className={fr.cx("fr-text--bold", "fr-mb-0")}>
        {displayedBusinessName}
      </p>
      <p className={fr.cx("fr-text--sm", "fr-hint-text", "fr-mb-0")}>
        {displayedBusinessName === establishment.businessName
          ? siretLabel
          : `${establishment.businessName} • ${siretLabel}`}
      </p>
    </>
  );
};

const EstablishmentRole = ({
  establishment,
}: {
  establishment: AcceptedUserEstablishmentRightDetails;
}): ReactNode => {
  const roleDisplay = establishmentRolesToDisplay[establishment.role];

  return (
    <Badge small className={fr.cx(roleDisplay.className)}>
      {roleDisplay.label}
    </Badge>
  );
};

const getAdminEmailsWithCurrentUserFirst = (
  establishment: AcceptedUserEstablishmentRightDetails,
  currentUserEmail: Email,
): Email[] =>
  [
    ...establishment.admins.filter(({ email }) => email === currentUserEmail),
    ...establishment.admins.filter(({ email }) => email !== currentUserEmail),
  ].map(({ email }) => email);

const EstablishmentAdmins = ({
  establishment,
  currentUserEmail,
  onShowAllAdminsClicked,
}: {
  establishment: AcceptedUserEstablishmentRightDetails;
  currentUserEmail: Email;
  onShowAllAdminsClicked: (
    establishment: AcceptedUserEstablishmentRightDetails,
  ) => void;
}): ReactNode => {
  const adminEmails = getAdminEmailsWithCurrentUserFirst(
    establishment,
    currentUserEmail,
  );

  return (
    <>
      <ul className={fr.cx("fr-raw-list")}>
        {adminEmails.slice(0, maxAdminsDisplayedInTable).map((email) => (
          <li key={email}>
            <AdminEmailItem email={email} currentUserEmail={currentUserEmail} />
          </li>
        ))}
      </ul>
      {adminEmails.length > maxAdminsDisplayedInTable && (
        <Button
          id={`${domElementIds.establishmentDashboard.manageEstablishments.showAllAdminsButton}-${establishment.siret}`}
          priority="tertiary"
          size="small"
          className={fr.cx("fr-mt-1w")}
          onClick={() => onShowAllAdminsClicked(establishment)}
        >
          Voir la liste complète ({adminEmails.length})
        </Button>
      )}
    </>
  );
};

const AdminEmailItem = ({
  email,
  currentUserEmail,
  copyButtonId,
}: {
  email: Email;
  currentUserEmail: Email;
  copyButtonId?: string;
}): ReactNode => {
  if (email === currentUserEmail)
    return <span className={fr.cx("fr-text--sm")}>Vous</span>;

  return (
    <>
      <a href={`mailto:${email}`} className={fr.cx("fr-link", "fr-link--sm")}>
        {email}
      </a>
      {copyButtonId && (
        <CopyButton
          id={copyButtonId}
          label="Copier l'adresse email"
          textToCopy={email}
          withIcon
          iconOnly
          className={fr.cx("fr-ml-1v")}
        />
      )}
    </>
  );
};

const AdminsListModalContent = ({
  establishment,
  currentUserEmail,
}: {
  establishment: AcceptedUserEstablishmentRightDetails;
  currentUserEmail: Email;
}): ReactNode => (
  <>
    <p className={fr.cx("fr-text--lg", "fr-mb-2w")}>
      {getDisplayedBusinessName(establishment)}
    </p>
    <p className={fr.cx("fr-hint-text", "fr-mb-2w")}>
      Pour modifier votre rôle ou débloquer l'accès d'un collègue, contactez
      l'un de ces administrateurs :
    </p>
    <ul className={fr.cx("fr-raw-list")}>
      {getAdminEmailsWithCurrentUserFirst(establishment, currentUserEmail).map(
        (email, index) => (
          <li key={email} className={fr.cx("fr-mb-1w")}>
            <AdminEmailItem
              email={email}
              currentUserEmail={currentUserEmail}
              copyButtonId={`${domElementIds.establishmentDashboard.manageEstablishments.adminsListModalCopyEmailButton}-${index}`}
            />
          </li>
        ),
      )}
    </ul>
  </>
);

const EstablishmentActions = ({
  establishment,
  isBackofficeAdmin,
  shouldUpdateAvailability,
  onManageEstablishmentClicked,
}: {
  establishment: AcceptedUserEstablishmentRightDetails;
  isBackofficeAdmin: boolean | undefined;
  shouldUpdateAvailability: string | undefined;
  onManageEstablishmentClicked: () => void;
}): ReactNode => {
  const establishmentFormLink =
    frontRoutes.establishmentDashboardFormEstablishment({
      siret: establishment.siret,
      shouldUpdateAvailability,
    }).link;

  return (
    <>
      {onlyAdminUserRightsWithStatusAccepted(establishment) ? (
        <Button
          id={`${domElementIds.establishmentDashboard.manageEstablishments.manageEstablishmentButton}-${establishment.siret}`}
          priority="secondary"
          size="small"
          linkProps={{
            ...establishmentFormLink,
            onClick: (event) => {
              onManageEstablishmentClicked();
              establishmentFormLink.onClick(event);
            },
          }}
        >
          Gérer l'entreprise
        </Button>
      ) : (
        <p className={fr.cx("fr-text--xs", "fr-hint-text", "fr-mb-0")}>
          <span
            className={fr.cx("fr-icon-lock-fill", "fr-icon--xs", "fr-mr-1v")}
            aria-hidden="true"
          />
          Gestion réservée aux administrateurs
        </p>
      )}
      {isBackofficeAdmin && (
        <Button
          id={`${domElementIds.establishmentDashboard.manageEstablishments.adminEstablishmentLink}-${establishment.siret}`}
          priority="tertiary no outline"
          size="small"
          linkProps={
            frontRoutes.adminEstablishments({ siret: establishment.siret }).link
          }
        >
          Voir comme admin IF
        </Button>
      )}
    </>
  );
};
