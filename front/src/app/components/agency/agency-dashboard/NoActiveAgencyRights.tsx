import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { useState } from "react";
import { type AgencyRight, type ConnectedUser, domElementIds } from "shared";
import { AgencyRightsTable } from "src/app/components/agency/agencies-table/AgencyRightsTable";
import { RegisterAgenciesForm } from "src/app/components/forms/register-agencies/RegisterAgenciesForm";
import { commonIllustrations } from "src/assets/img/illustrations";

export function NoActiveAgencyRights({
  toReviewAgencyRights,
  currentUser,
  onUserRegistrationCancelledRequested,
}: {
  toReviewAgencyRights: AgencyRight[];
  currentUser: ConnectedUser;
  onUserRegistrationCancelledRequested: (agencyRight: AgencyRight) => void;
}): JSX.Element {
  const [showRegistrationForm, setShowRegistrationForm] =
    useState<boolean>(false);

  return (
    <>
      <h2 className={fr.cx("fr-mt-2w")}>Suivi de mes demandes</h2>
      <div className={fr.cx("fr-grid-row")}>
        <div
          className={fr.cx(
            "fr-hidden",
            "fr-unhidden-lg",
            "fr-col-2",
            "fr-pr-2w",
          )}
        >
          <div>
            <img src={commonIllustrations.error} alt="attention" />
          </div>
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-lg-10")}>
          <h3>
            Votre demande d'accès à {toReviewAgencyRights.length}{" "}
            {toReviewAgencyRights.length === 1 ? "organisme" : "organismes"}{" "}
            {toReviewAgencyRights.length === 1
              ? "prescripteur"
              : "prescripteurs"}{" "}
            est en cours d'étude
          </h3>
          <p>
            Dès qu'un accès est validé par un administrateur, vous serez notifié
            par email et pourrez consulter les conventions de l'organisme dans
            votre espace personnel.
          </p>

          <AgencyRightsTable
            mode="rights-to-review"
            agencyRights={toReviewAgencyRights}
            user={currentUser}
            title={`Demandes d'accès en cours (${toReviewAgencyRights.length})`}
            onUserRegistrationCancelledRequested={
              onUserRegistrationCancelledRequested
            }
          />
        </div>
      </div>

      <div className={fr.cx("fr-grid-row")}>
        <div
          className={fr.cx(
            "fr-hidden",
            "fr-unhidden-lg",
            "fr-col-2",
            "fr-pr-2w",
          )}
        >
          <div>
            <img src={commonIllustrations.reachData} alt="attention" />
          </div>
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-lg-10")}>
          <h3>Vous travaillez ailleurs ?</h3>
          {showRegistrationForm ? (
            <RegisterAgenciesForm currentUser={currentUser} />
          ) : (
            <Button
              id={
                domElementIds.agencyDashboard.registerAgencies
                  .showRegistrationFormButton
              }
              onClick={() => {
                setShowRegistrationForm(true);
              }}
            >
              Demander l'accès à d'autre organismes
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
