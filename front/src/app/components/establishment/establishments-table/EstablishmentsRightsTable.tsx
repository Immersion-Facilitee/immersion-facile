import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { type ReactNode, useState } from "react";
import {
  ResponsiveTable,
  SortableTableHeader,
  type TableSortDirection,
} from "react-design-system";
import {
  type EstablishmentUserRightStatus,
  getDisplayedBusinessName,
  type UserEstablishmentRightDetails,
  type UserEstablishmentRightDetailsWithAcceptedStatus,
  type UserEstablishmentRightDetailsWithPendingStatus,
} from "shared";
import { establishmentRolesToDisplay } from "src/app/contents/userRolesToDisplay";
import { match } from "ts-pattern";
import { EstablishmentLineAdminsInfos } from "./establishment-line/EstablishmentLineAdminInfos";
import { EstablishmentLineBusinessName } from "./establishment-line/EstablishmentLineBusinessName";
import { EstablishmentLineDesiredRoleInfos } from "./establishment-line/EstablishmentLineDesiredRoleInfos";

type SortColumn = "businessName" | "role";

type SortState = {
  column: SortColumn;
  direction: Exclude<TableSortDirection, false>;
};

export const EstablishmentsRightsTable = ({
  withEstablishmentData,
  isBackofficeAdmin,
  title,
}: {
  withEstablishmentData: UserEstablishmentRightDetails[];
  isBackofficeAdmin?: boolean;
  title?: ReactNode;
}) => {
  const [sort, setSort] = useState<SortState>({
    column: "businessName",
    direction: "asc",
  });

  if (withEstablishmentData.length === 0) {
    return null;
  }

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

  return (
    <>
      {title}
      <ResponsiveTable
        headers={getEstablishmentRightLineHeaders({
          status: withEstablishmentData[0].status,
          sortDirectionFor,
          onSortClick,
        })}
        data={[...withEstablishmentData]
          .sort((a, b) => compareEstablishmentRights(a, b, sort))
          .map((data) =>
            makeEstablishmentRightLine({
              data,
              isBackofficeAdmin,
              isEstablishmentBanned: data.isEstablishmentBanned,
            }),
          )}
      />
    </>
  );
};

const compareEstablishmentRights = (
  a: UserEstablishmentRightDetails,
  b: UserEstablishmentRightDetails,
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

const getEstablishmentRightLineHeaders = ({
  status,
  sortDirectionFor,
  onSortClick,
}: {
  status: EstablishmentUserRightStatus;
  sortDirectionFor: (column: SortColumn) => TableSortDirection;
  onSortClick: (column: SortColumn) => void;
}): ReactNode[] => {
  const businessNameHeader = (
    <SortableTableHeader
      content="Entreprise"
      direction={sortDirectionFor("businessName")}
      onClick={() => onSortClick("businessName")}
    />
  );
  const roleHeader = (
    <SortableTableHeader
      content={status === "ACCEPTED" ? "Rôle" : "Rôle et préférences demandés"}
      direction={sortDirectionFor("role")}
      onClick={() => onSortClick("role")}
    />
  );

  return match(status)
    .with("ACCEPTED", () => [businessNameHeader, "Administrateurs", roleHeader])
    .with("PENDING", () => [businessNameHeader, roleHeader])
    .exhaustive();
};

const makeEstablishmentRightLine = ({
  data,
  isEstablishmentBanned,
  isBackofficeAdmin,
}: {
  data:
    | UserEstablishmentRightDetailsWithAcceptedStatus
    | UserEstablishmentRightDetailsWithPendingStatus;
  isEstablishmentBanned: boolean;
  isBackofficeAdmin?: boolean;
}): ReactNode[] => {
  const roleDisplay = establishmentRolesToDisplay[data.role];
  return match(data)
    .with({ status: "ACCEPTED" }, (data) => [
      <EstablishmentLineBusinessName
        key={data.siret}
        data={data}
        isEstablishmentBanned={isEstablishmentBanned}
        isBackofficeAdmin={isBackofficeAdmin}
      />,
      <EstablishmentLineAdminsInfos key={data.siret} data={data} />,
      <Badge
        small
        className={fr.cx(roleDisplay.className, "fr-mr-1w")}
        key={roleDisplay.label}
      >
        {roleDisplay.label}
      </Badge>,
    ])
    .with({ status: "PENDING" }, (data) => [
      <EstablishmentLineBusinessName
        key={data.siret}
        data={data}
        isEstablishmentBanned={isEstablishmentBanned}
        isBackofficeAdmin={isBackofficeAdmin}
      />,
      <EstablishmentLineDesiredRoleInfos key={data.siret} data={data} />,
    ])
    .exhaustive();
};
