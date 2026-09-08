import { SearchBar } from "@codegouvfr/react-dsfr/SearchBar";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { type ElementRef, useRef } from "react";
import { useDispatch } from "react-redux";
import { domElementIds, frontRoutes } from "shared";
import { NameAndEmailInTable } from "src/app/components/admin/NameAndEmailInTable";
import { UsersWithoutNameHint } from "src/app/components/agency/UsersWithoutNameHint";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { listUsersSelectors } from "src/core-logic/domain/admin/listUsers/listUsers.selectors";
import { listUsersSlice } from "src/core-logic/domain/admin/listUsers/listUsers.slice";

export const UsersTab = () => {
  const dispatch = useDispatch();
  const query = useAppSelector(listUsersSelectors.query);

  const inputElement = useRef<ElementRef<"input">>(null);

  return (
    <BackofficeDashboardTabContent
      title="Utilisateurs"
      description={<UsersWithoutNameHint />}
      titleAction={
        <SearchBar
          renderInput={({ className, id, placeholder, type }) => (
            <input
              ref={inputElement}
              className={className}
              id={id}
              placeholder={placeholder}
              type={type}
              value={query}
              // Note: The default behavior for an input of type 'text' is to clear the input value when the escape key is pressed.
              // However, due to a bug in @gouvfr/dsfr the escape key event is not propagated to the input element.
              // As a result this onChange is not called when the escape key is pressed.
              onChange={(event) =>
                dispatch(
                  listUsersSlice.actions.queryUpdated(
                    event.currentTarget.value,
                  ),
                )
              }
              // Same goes for the keydown event so this is useless but we hope the bug will be fixed soon.
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  inputElement.current?.blur();
                }
              }}
            />
          )}
        />
      }
      titleActionCols={4}
    >
      <UsersTable />
    </BackofficeDashboardTabContent>
  );
};

const UsersTable = () => {
  const isFetching = useAppSelector(listUsersSelectors.isFetching);
  const users = useAppSelector(listUsersSelectors.users);

  if (isFetching) return <p>Chargement en cours...</p>;
  if (users.length === 0)
    return <p>Aucun utilisateur correspondant à votre recherche</p>;

  return (
    <Table
      id={domElementIds.admin.usersTab.usersTable}
      headers={[
        "Utilisateur",
        "Nombre d'agences liées",
        "Nombre d'établissements liés",
        "Actions",
      ]}
      data={users.map((user) => [
        <NameAndEmailInTable
          key={`${user.id}-name-and-email`}
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
        />,
        user.numberOfAgencies,
        user.numberOfEstablishments,
        <a
          key={`${user.id}-details-link`}
          {...frontRoutes.adminUserDetail({ userId: user.id })}
        >
          Détails
        </a>,
      ])}
    />
  );
};
