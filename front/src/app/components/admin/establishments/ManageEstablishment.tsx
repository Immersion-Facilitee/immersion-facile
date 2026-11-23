import { fr } from "@codegouvfr/react-dsfr";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type BanEstablishmentAdminForm,
  banEstablishmentAdminFormSchema,
  domElementIds,
  errors,
  frontRoutes,
  type ManageEstablishmentAdminForm,
  manageEstablishmentAdminFormSchema,
} from "shared";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { BackofficeDashboardTabContent } from "../../layout/BackofficeDashboardTabContent";

const banEstablishmentModal = createModal({
  isOpenedByDefault: false,
  id: "im-ban_establishment-modal",
});

export const ManageEstablishment = (): JSX.Element => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);

  const { register, handleSubmit, formState, setValue, watch } =
    useForm<ManageEstablishmentAdminForm>({
      resolver: zodResolver(manageEstablishmentAdminFormSchema),
      mode: "onTouched",
    });

  const {
    register: registerBan,
    handleSubmit: handleBanSubmit,
    formState: banFormState,
  } = useForm<BanEstablishmentAdminForm>({
    resolver: zodResolver(banEstablishmentAdminFormSchema),
    mode: "onTouched",
  });

  const siret = watch("siret");

  if (!connectedUserJwt) throw errors.user.noJwtProvided();

  return (
    <BackofficeDashboardTabContent title="Piloter une entreprise">
      <div className={fr.cx("fr-card", "fr-px-4w", "fr-py-2w", "fr-mb-4w")}>
        <form
          onSubmit={handleSubmit(({ siret }) =>
            frontRoutes.adminEstablishments({ siret }).push(),
          )}
        >
          <div className={fr.cx("fr-grid-row")}>
            <Input
              label="Siret de l'entreprise"
              nativeInputProps={{
                ...register("siret"),
                onChange: (event) => {
                  setValue("siret", event.currentTarget.value.trim(), {
                    shouldValidate: true,
                  });
                },
                id: domElementIds.admin.manageEstablishment.siretInput,
                placeholder: "ex: 1234567891234",
              }}
              className={fr.cx("fr-col-12", "fr-col-lg-6")}
              {...makeFieldError(formState)("siret")}
            />
          </div>
          <ButtonsGroup
            buttonsIconPosition="left"
            alignment="left"
            inlineLayoutWhen="always"
            buttons={[
              {
                id: domElementIds.admin.manageEstablishment.searchButton,
                disabled: !formState.isValid,
                children: "Piloter l'entreprise",
              },
              {
                id: domElementIds.admin.manageEstablishment.banButton,
                disabled: !formState.isValid,
                iconId: "fr-icon-error-warning-line",
                iconPosition: "left",
                type: "button",
                priority: "secondary",
                onClick: () => banEstablishmentModal.open(),
                children: "Bannir l'entreprise",
              },
            ]}
            className={fr.cx("fr-mt-2w")}
          />
        </form>
      </div>

      {createPortal(
        <banEstablishmentModal.Component
          title="Bannir l'entreprise"
          buttons={[
            { doClosesModal: true, children: "Annuler", priority: "secondary" },
            {
              doClosesModal: true,
              children: "Confirmer le bannissement",
              disabled: !banFormState.isValid,
              onClick: handleBanSubmit(
                ({ establishmentBannishmentJustification }) => {
                  dispatch(
                    establishmentSlice.actions.banEstablishmentRequested({
                      siret,
                      establishmentBannishmentJustification,
                      feedbackTopic: "ban-establishment",
                      jwt: connectedUserJwt,
                    }),
                  );
                },
              ),
            },
          ]}
        >
          <p>
            Vous êtes sur le point d’ajouter le SIRET de cette entreprise dans
            la blacklist d’Immersion Facilitée. Elle ne pourra donc plus se
            référencer elle-même.
          </p>
          <Input
            label="Motif du bannissement"
            textArea
            nativeTextAreaProps={{
              rows: 6,
              ...registerBan("establishmentBannishmentJustification"),
            }}
            {...makeFieldError(banFormState)(
              "establishmentBannishmentJustification",
            )}
          />
        </banEstablishmentModal.Component>,
        document.body,
      )}
    </BackofficeDashboardTabContent>
  );
};
