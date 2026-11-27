import { fr } from "@codegouvfr/react-dsfr";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import {
  domElementIds,
  type FormEstablishmentDto,
  frontRoutes,
  toDisplayedDate,
} from "shared";
import { FullPageFeedback } from "src/app/components/feedback/FullpageFeedback";
import { establishmentCreationConfirmationContent } from "src/app/contents/forms/establishment/formEstablishment";
import { commonIllustrations } from "src/assets/img/illustrations";

type EstablishmentCreationConfirmationProps = {
  formEstablishment: FormEstablishmentDto;
};

export const EstablishmentCreationConfirmation = ({
  formEstablishment,
}: EstablishmentCreationConfirmationProps): JSX.Element => {
  const establishmentName =
    formEstablishment.businessNameCustomized || formEstablishment.businessName;
  const nextAvailabilityDate = formEstablishment.nextAvailabilityDate
    ? new Date(formEstablishment.nextAvailabilityDate)
    : null;
  const availableFrom =
    nextAvailabilityDate && nextAvailabilityDate > new Date()
      ? toDisplayedDate({ date: nextAvailabilityDate })
      : null;
  const establishmentDetailsLinkProps =
    frontRoutes.establishmentDashboardEstablishmentOffers({
      siret: formEstablishment.siret,
    }).link;

  return (
    <FullPageFeedback
      includeWrapper={false}
      title={establishmentCreationConfirmationContent.title}
      titleClassName="fr-h3"
      illustration={commonIllustrations.establishmentCreated}
      content={
        <>
          <p className={fr.cx("fr-text--lg", "fr-mb-4w")}>
            {establishmentCreationConfirmationContent.visibility({
              establishmentName,
              availableFrom,
            })}
          </p>
          <Highlight className={fr.cx("fr-ml-0")}>
            <strong>
              {establishmentCreationConfirmationContent.superEstablishmentTitle}
            </strong>{" "}
            {
              establishmentCreationConfirmationContent.superEstablishmentDescription
            }
          </Highlight>
        </>
      }
      buttons={[
        {
          children: establishmentCreationConfirmationContent.addOtherOfferLabel,
          id: domElementIds.formEstablishment.create.addOtherOfferButton,
          linkProps: frontRoutes.establishmentDashboardEstablishmentOffer({
            siret: formEstablishment.siret,
          }).link,
        },
        {
          children:
            establishmentCreationConfirmationContent.seeEstablishmentLabel,
          priority: "secondary",
          id: domElementIds.formEstablishment.create
            .navigateToEstablishmentDashboard,
          linkProps: establishmentDetailsLinkProps,
        },
      ]}
    />
  );
};
