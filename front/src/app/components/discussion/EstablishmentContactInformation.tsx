import { fr } from "@codegouvfr/react-dsfr";
import { BorderedSection } from "react-design-system";
import {
  addressDtoToString,
  type ContactMode,
  type DiscussionEstablishmentContactInfo,
  getFormattedFirstnameAndLastname,
  toDisplayedPhoneNumber,
} from "shared";

export const EstablishmentContactInformation = ({
  discussionEstablishmentContactInfo,
  contactMode,
}: {
  discussionEstablishmentContactInfo: DiscussionEstablishmentContactInfo | null;
  contactMode: Extract<ContactMode, "IN_PERSON" | "PHONE">;
}) => {
  const contactDetail =
    contactMode === "IN_PERSON"
      ? ((discussionEstablishmentContactInfo?.potentialBeneficiaryWelcomeAddress &&
          addressDtoToString(
            discussionEstablishmentContactInfo
              .potentialBeneficiaryWelcomeAddress.address,
          )) ??
        "Un mail avec l'adresse de l'entreprise et la personne a contacter sur place vous a été envoyé")
      : discussionEstablishmentContactInfo &&
        toDisplayedPhoneNumber(
          discussionEstablishmentContactInfo.mainContact.phone,
        );

  return (
    <BorderedSection>
      <h5 className={fr.cx("fr-h5")}>Coordonnées de l'entreprise</h5>
      {discussionEstablishmentContactInfo && contactDetail ? (
        <ul className={fr.cx("fr-raw-list")}>
          <li className={fr.cx("fr-mb-1w")}>
            <strong>
              {getFormattedFirstnameAndLastname({
                firstname:
                  discussionEstablishmentContactInfo.mainContact.firstName,
                lastname:
                  discussionEstablishmentContactInfo.mainContact.lastName,
              })}
            </strong>
          </li>
          <li>{contactDetail}</li>
        </ul>
      ) : (
        "Aucune information trouvée"
      )}
    </BorderedSection>
  );
};
