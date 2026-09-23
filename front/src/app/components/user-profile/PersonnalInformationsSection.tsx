import { fr } from "@codegouvfr/react-dsfr";
import type { ConnectedUser } from "shared";

export const PersonnalInformationsSection = ({
  user,
}: {
  user: ConnectedUser;
}) => (
  <>
    <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>Informations personnelles</h2>

    <p>
      Pour modifier vos informations personnelles, vous devez passer par votre
      compte ProConnect créé avec l'email : {user.email}
    </p>
  </>
);
