import { fr } from "@codegouvfr/react-dsfr";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import {
  type ConnectedUser,
  domElementIds,
  type MarkPartnersErroredConventionAsHandledRequest,
  markPartnersErroredConventionAsHandledRequestSchema,
} from "shared";

type MarkConventionAsHandledModalContentProps = {
  conventionId: string;
  currentUser: ConnectedUser;
  closeModal: () => void;
  onSubmit: (params: MarkPartnersErroredConventionAsHandledRequest) => void;
};

export const MarkConventionAsHandledModalContent = ({
  conventionId,
  currentUser,
  closeModal,
  onSubmit: onSubmitProp,
}: MarkConventionAsHandledModalContentProps) => {
  const isFtUser = currentUser?.agencyRights.some(
    (agencyRight) =>
      agencyRight.agency.kind === "france-travail" &&
      !agencyRight.roles.includes("to-review"),
  );

  const methods = useForm<MarkPartnersErroredConventionAsHandledRequest>({
    resolver: zodResolver(markPartnersErroredConventionAsHandledRequestSchema),
    mode: "onTouched",
    defaultValues: {
      conventionId,
    },
  });

  const onSubmit = ({
    conventionId,
  }: MarkPartnersErroredConventionAsHandledRequest) => {
    onSubmitProp({ conventionId });
    closeModal();
  };

  return (
    <>
      <p>
        Vous allez marquer une convention comme traitée l'avez vous saisie
        manuellement ?
      </p>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <ButtonsGroup
            className={fr.cx("fr-mt-4w", "fr-mb-2w")}
            buttonsEquisized
            alignment="center"
            inlineLayoutWhen="always"
            buttons={[
              {
                id: domElementIds.manageConvention
                  .markConventionAsHandledButton,
                children: "Oui (Marquer la convention comme traitée)",
                priority: "primary",
                type: "submit",
              },
              {
                children: "Non (Ne pas marquer la convention comme traitée)",
                priority: "secondary",
                onClick: closeModal,
              },
            ]}
          />
        </form>
      </FormProvider>

      {isFtUser && (
        <p>
          Si nécessaire, vous pouvez retrouver les instructions détaillées pour
          la saisie d'une convention en cliquant sur le lien suivant:{" "}
          <a
            href="https://poleemploi.sharepoint.com/:p:/r/sites/NAT-Mediatheque-Appropriation/Documents/Immersion_facilitee/Immersion_facilitee/Guide_de_gestion_des_conventions_en_erreur.pptx?d=w489a3c6b6e5148e6bea287ddfadba8c7&csf=1&web=1&e=i1GD5H"
            target="_blank"
            rel="noreferrer"
          >
            Guide de gestion des conventions en erreur
          </a>
        </p>
      )}
    </>
  );
};
