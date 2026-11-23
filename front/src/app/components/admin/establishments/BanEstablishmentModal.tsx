import Input from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type BanEstablishmentAdminForm,
  banEstablishmentAdminFormSchema,
  type SiretDto,
} from "shared";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";

export const banEstablishmentModal = createModal({
  isOpenedByDefault: false,
  id: "im-ban_establishment-modal",
});

export const BanEstablishmentModal = ({
  siret,
}: {
  siret: SiretDto;
}): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const { register, handleSubmit, formState } =
    useForm<BanEstablishmentAdminForm>({
      resolver: zodResolver(banEstablishmentAdminFormSchema),
      mode: "onTouched",
    });

  if (!connectedUserJwt) return null;

  return createPortal(
    <banEstablishmentModal.Component
      title="Bannir l'entreprise"
      buttons={[
        { doClosesModal: true, children: "Annuler", priority: "secondary" },
        {
          doClosesModal: true,
          children: "Confirmer le bannissement",
          disabled: !formState.isValid,
          onClick: handleSubmit(({ establishmentBannishmentJustification }) => {
            dispatch(
              establishmentSlice.actions.banEstablishmentRequested({
                siret,
                establishmentBannishmentJustification,
                feedbackTopic: "ban-establishment",
                jwt: connectedUserJwt,
              }),
            );
          }),
        },
      ]}
    >
      <p>
        Vous êtes sur le point d’ajouter le SIRET de cette entreprise dans la
        blacklist d’Immersion Facilitée. Elle ne pourra donc plus se référencer
        elle-même.
      </p>
      <Input
        label="Motif du bannissement"
        textArea
        nativeTextAreaProps={{
          rows: 6,
          ...register("establishmentBannishmentJustification"),
        }}
        {...makeFieldError(formState)("establishmentBannishmentJustification")}
      />
    </banEstablishmentModal.Component>,
    document.body,
  );
};
