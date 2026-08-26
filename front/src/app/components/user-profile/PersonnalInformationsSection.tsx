import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { type ConnectedUser, domElementIds } from "shared";

export const PersonnalInformationsSection = ({
  user,
  editInformationsLink,
}: {
  user: ConnectedUser;
  editInformationsLink?: string;
}) => (
  <>
    <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>Informations personnelles</h2>

    <p>
      Pour modifier vos informations personnelles, vous devez passer par votre
      compte ProConnect créé avec l'email : {user.email}
    </p>

    {editInformationsLink && (
      <Button
        className={fr.cx("fr-mb-4w")}
        priority="secondary"
        linkProps={{
          href: editInformationsLink,
          target: "_blank",
        }}
        id={domElementIds.myAccount.updateOwnInfosLink}
        size="small"
      >
        Changer mes informations sur ProConnect
      </Button>
    )}
  </>
);
