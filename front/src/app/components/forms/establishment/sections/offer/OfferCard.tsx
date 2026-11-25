import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { useFormContext } from "react-hook-form";
import {
  domElementIds,
  type FormEstablishmentDto,
  remoteWorkModeLabels,
  removeAtIndex,
} from "shared";
import type { Mode } from "src/app/routes/routes.hooks";

export const OfferCard = ({
  index,
  mode,
  onEditOfferClick,
  onDeleteOfferClick,
}: {
  index: number;
  mode: Mode;
  onEditOfferClick: () => void;
  onDeleteOfferClick?: () => void;
}) => {
  const { setValue, watch } = useFormContext<FormEstablishmentDto>();
  const formValues = watch();
  const { appellationLabel, remoteWorkMode } = formValues.offers[index];
  return (
    <div
      className={fr.cx("fr-col-12", "fr-col-lg-6")}
      id={`${domElementIds.formEstablishment[mode].offerCard}-${index}`}
    >
      <article className={fr.cx("fr-card", "fr-p-2w", "fr-pt-1v")}>
        <div className={fr.cx("fr-grid-row", "fr-grid-row--top")}>
          <h3 className={fr.cx("fr-h6", "fr-col-lg-6", "fr-col-5", "fr-mb-0")}>
            {appellationLabel}
          </h3>
          <Badge className={fr.cx("fr-badge--purple-glycine", "fr-ml-auto")}>
            {remoteWorkModeLabels[remoteWorkMode].label}
          </Badge>
        </div>
        <p className={fr.cx("fr-mt-2w", "fr-text--sm")}>
          {remoteWorkModeLabels[remoteWorkMode].description}
        </p>
        <ButtonsGroup
          buttons={[
            {
              children: "Modifier",
              iconPosition: "right",
              iconId: "fr-icon-edit-line",
              priority: "tertiary",
              type: "button",
              className: fr.cx("fr-mb-0"),
              onClick: onEditOfferClick,
              id: `${domElementIds.formEstablishment[mode].editOfferButton}-${index}`,
            },
            {
              children: "Supprimer",
              iconPosition: "right",
              iconId: "fr-icon-delete-bin-line",
              priority: "tertiary",
              type: "button",
              className: fr.cx("fr-mb-0"),
              id: `${domElementIds.formEstablishment[mode].deleteOfferButton}-${index}`,
              onClick:
                onDeleteOfferClick ??
                (() =>
                  setValue("offers", removeAtIndex(formValues.offers, index))),
            },
          ]}
          className={fr.cx("fr-mt-auto")}
          inlineLayoutWhen="always"
        />
      </article>
    </div>
  );
};
