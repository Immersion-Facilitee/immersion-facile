import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { authRoutes, frontRoutes, makeUrlWithQueryParams } from "shared";

export const ConventionEmailWarning = ({
  shouldShowFtSpecificMessage,
}: {
  shouldShowFtSpecificMessage: boolean;
}) => {
  return (
    <Alert
      small
      severity="info"
      className={fr.cx("fr-mb-2w")}
      description={
        shouldShowFtSpecificMessage ? (
          <>
            L'adresse email indiquée doit être la même que celle du compte
            France Travail du candidat. Cela permet de transmettre correctement
            la convention à la structure d'accompagnement sélectionnée. Il est
            possible de{" "}
            <a
              href={makeUrlWithQueryParams(
                `/api${authRoutes.initiateLoginByOAuth.url}`,
                {
                  provider: "ftConnect",
                  redirectUri: frontRoutes.conventionImmersion().href,
                },
              )}
            >
              se connecter
            </a>{" "}
            à l'espace France Travail pour pré-remplir cette adresse et d'autres
            informations.
          </>
        ) : (
          "Cette adresse email sera utilisée dans le cadre de la signature de la convention d'immersion. Pensez à bien vérifier son exactitude."
        )
      }
    />
  );
};
