import { fr } from "@codegouvfr/react-dsfr";
import Table from "@codegouvfr/react-dsfr/Table";
import { HeadingSection } from "react-design-system";
import { getFormattedFirstnameAndLastname } from "shared";
import type { UserToReview } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";

export const AgencyAdminUsersToReview = ({
  usersToReview,
}: {
  usersToReview: UserToReview[];
}) => {
  return (
    <HeadingSection
      className={fr.cx("fr-mt-0")}
      title="Demandes de rattachement"
      titleAs="h2"
    >
      <Table
        fixed
        headers={["Utilisateurs", "Organisme demandé", "Actions"]}
        data={usersToReview.map((userToReview) =>
          TableLine({ userToReview: userToReview }),
        )}
      />
    </HeadingSection>
  );
};

const TableLine = ({ userToReview }: { userToReview: UserToReview }) => {
  const userFullname = getFormattedFirstnameAndLastname({
    firstname: userToReview.firstName,
    lastname: userToReview.lastName,
  });
  const userNameAndEmail = (
    <>
      {userFullname.length > 0 && (
        <p>
          <strong>{userFullname}</strong>
        </p>
      )}
      <p>{userToReview.email}</p>
    </>
  );
  return [userNameAndEmail, userToReview.agencyName, ""];
};
