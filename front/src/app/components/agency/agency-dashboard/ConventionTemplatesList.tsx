import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import {
  HeadingSection,
  Loader,
  SectionHighlight,
  Task,
} from "react-design-system";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import {
  type ConventionTemplate,
  type ConventionTemplateId,
  domElementIds,
  errors,
  frontRoutes,
  miniStageAgencyKinds,
  type SaveConventionDraftFromConventionTemplateDto,
  saveConventionDraftFromConventionTemplateSchema,
  toDisplayedDate,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { setValueAsUndefined } from "src/app/utils/form.utils";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionDraftSlice } from "src/core-logic/domain/convention/convention-draft/conventionDraft.slice";
import { conventionTemplateSelectors } from "src/core-logic/domain/convention-template/conventionTemplate.selectors";
import { conventionTemplateSlice } from "src/core-logic/domain/convention-template/conventionTemplate.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";
import { v4 as uuid } from "uuid";

const shareConventionTemplateModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.conventionTemplate.shareAsConventionDraft.modal,
});

const deleteConventionTemplateModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.conventionTemplate.deleteConventionTemplate.modal,
});

const makeConventionDraftDtoFromConventionTemplate = (
  conventionTemplate: ConventionTemplate,
) => {
  const { id: _1, name: _2, userId: _3, ...rest } = conventionTemplate;
  return {
    ...rest,
    id: uuid(),
  };
};

export const ConventionTemplatesList = ({
  fromRoute,
}: {
  fromRoute: Route<
    | typeof frontRoutes.agencyDashboard
    | typeof frontRoutes.establishmentDashboard
  >;
}) => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoading = useSelector(conventionTemplateSelectors.isLoading);
  const conventionTemplates = useSelector(
    conventionTemplateSelectors.conventionTemplates,
  );
  const [conventionTemplateIdToDelete, setConventionTemplateIdToDelete] =
    useState<ConventionTemplateId | null>(null);

  const openDeleteModal = (conventionTemplateId: ConventionTemplateId) => {
    setConventionTemplateIdToDelete(conventionTemplateId);
    deleteConventionTemplateModal.open();
  };

  const confirmDeleteConventionTemplate = () => {
    if (!conventionTemplateIdToDelete) return;
    if (!connectedUserJwt) throw errors.user.unauthorized();
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    dispatch(
      conventionTemplateSlice.actions.deleteConventionTemplateRequested({
        conventionTemplateId: conventionTemplateIdToDelete,
        jwt: connectedUserJwt,
        feedbackTopic: "convention-template",
      }),
    );
    setConventionTemplateIdToDelete(null);
  };

  const cancelDeleteConventionTemplate = () => {
    setConventionTemplateIdToDelete(null);
  };

  const shareForm = useForm<SaveConventionDraftFromConventionTemplateDto>({
    mode: "onTouched",
    defaultValues: { recipientEmail: "" },
    resolver: zodResolver(saveConventionDraftFromConventionTemplateSchema),
  });
  const { register, handleSubmit, formState, reset } = shareForm;

  const openShareModal = (conventionTemplateId: ConventionTemplateId) => {
    const conventionTemplate = conventionTemplates.find(
      (template) => template.id === conventionTemplateId,
    );
    if (!conventionTemplate)
      throw errors.conventionTemplate.notFound({ conventionTemplateId });

    reset({
      recipientEmail: "",
      details: "",
      conventionDraft:
        makeConventionDraftDtoFromConventionTemplate(conventionTemplate),
    });
    shareConventionTemplateModal.open();
  };

  const onShareFormSubmit = (
    values: SaveConventionDraftFromConventionTemplateDto,
  ) => {
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    dispatch(
      conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
        ...values,
        feedbackTopic: "convention-draft",
      }),
    );

    shareConventionTemplateModal.close();
  };

  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        conventionTemplateSlice.actions.fetchConventionTemplatesRequested({
          jwt: connectedUserJwt,
          feedbackTopic: "convention-template",
        }),
      );
    }
  }, [connectedUserJwt, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    };
  }, [dispatch]);

  const hasMiniStageAgencyOnly =
    currentUser?.agencyRights.some((agency) =>
      miniStageAgencyKinds.includes(agency.agency.kind),
    ) &&
    !currentUser?.agencyRights.some(
      (agency) => !miniStageAgencyKinds.includes(agency.agency.kind),
    );

  return (
    <>
      <HeadingSection
        title="Mes modèles de conventions"
        titleAs="h3"
        className={fr.cx("fr-mt-4w")}
        titleAction={
          !hasMiniStageAgencyOnly && (
            <Button
              id={
                domElementIds.conventionTemplate.createConventionTemplateButton
              }
              priority="primary"
              iconId="fr-icon-add-line"
              linkProps={
                frontRoutes.conventionTemplate({
                  fromRoute: fromRoute.name,
                }).link
              }
            >
              Créer un nouveau modèle
            </Button>
          )
        }
      >
        {isLoading && <Loader />}
        <Feedback
          topics={["convention-template", "convention-draft"]}
          closable
        />
        <div
          className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-1w")}
        >
          {conventionTemplates.length === 0 && (
            <SectionHighlight
              priority="discrete"
              className={fr.cx("fr-px-2w", "fr-pt-2w", "fr-pb-0")}
            >
              <p>
                <strong>Vous n’avez pas encore de modèle de convention.</strong>
              </p>
              <p>
                Les modèles vous permettent de gagner du temps lorsque vous
                devez préparer plusieurs immersions similaires (job dating,
                plusieurs immersions pour un même candidat ou un même métier,
                etc.)
              </p>
              <p>
                Créez votre premier modèle pour pré-remplir automatiquement les
                informations qui reviennent souvent, et partagez-le facilement
                avec les autres parties concernées.
              </p>
            </SectionHighlight>
          )}
          {conventionTemplates.map((template) => (
            <div
              key={template.id}
              id={`convention-template-${template.id}`}
              className={fr.cx("fr-col-12", "fr-col-lg-6")}
            >
              <Task
                title={template.name}
                titleAs="h4"
                footer={`Mise à jour le ${template.updatedAt ? toDisplayedDate({ date: new Date(template.updatedAt), withHours: true }) : ""}`}
                hasBackgroundColor={true}
                buttonsRows={[
                  {
                    id: "edit-delete",
                    content: (
                      <>
                        <Button
                          id={`${domElementIds.conventionTemplate.editConventionTemplateButton}-${template.id}`}
                          priority="tertiary"
                          iconId="fr-icon-edit-line"
                          iconPosition="right"
                          linkProps={
                            frontRoutes.conventionTemplate({
                              fromRoute: fromRoute.name,
                              conventionTemplateId: template.id,
                            }).link
                          }
                        >
                          Modifier
                        </Button>
                        <Button
                          id={`${domElementIds.conventionTemplate.deleteConventionTemplateButton}-${template.id}`}
                          priority="tertiary"
                          iconId="fr-icon-delete-bin-line"
                          title="Supprimer"
                          onClick={() => openDeleteModal(template.id)}
                        />
                      </>
                    ),
                  },
                  {
                    id: "share",
                    content: (
                      <Button
                        id={`${domElementIds.conventionTemplate.shareAsConventionDraft.button}-${template.id}`}
                        priority="tertiary no outline"
                        iconId="fr-icon-send-plane-line"
                        iconPosition="right"
                        onClick={() => openShareModal(template.id)}
                      >
                        Envoyer en brouillon
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      </HeadingSection>
      {createPortal(
        <deleteConventionTemplateModal.Component
          title="Supprimer ce modèle de convention ?"
          buttons={[
            {
              id: domElementIds.conventionTemplate.deleteConventionTemplate
                .cancelButton,
              children: "Annuler",
              priority: "secondary",
              onClick: cancelDeleteConventionTemplate,
            },
            {
              id: domElementIds.conventionTemplate.deleteConventionTemplate
                .confirmButton,
              children: "Supprimer",
              priority: "primary",
              onClick: confirmDeleteConventionTemplate,
            },
          ]}
        >
          <p className={fr.cx("fr-text--sm")}>
            Le modèle sera définitivement supprimé.
          </p>
        </deleteConventionTemplateModal.Component>,
        document.body,
      )}
      {createPortal(
        <shareConventionTemplateModal.Component
          title="Partager ce modèle en brouillon"
          buttons={[
            {
              id: domElementIds.conventionTemplate.shareAsConventionDraft
                .cancelButton,
              children: "Annuler",
              priority: "secondary",
              onClick: shareConventionTemplateModal.close,
            },
            {
              id: domElementIds.conventionTemplate.shareAsConventionDraft
                .submitButton,
              doClosesModal: false,
              children: "Envoyer le brouillon",
              type: "submit",
              nativeButtonProps: {
                form: domElementIds.conventionTemplate.shareAsConventionDraft
                  .form,
              },
            },
          ]}
        >
          <form
            id={domElementIds.conventionTemplate.shareAsConventionDraft.form}
            onSubmit={handleSubmit(onShareFormSubmit)}
            noValidate
          >
            <p className={fr.cx("fr-text--sm", "fr-mb-3w")}>
              Saisissez l'adresse email de la personne à qui vous souhaitez
              partager ce modèle en version brouillon. Elle pourra le modifier
              et créer une convention à partir de celui-ci, sans que cela
              n'impacte votre modèle d'origine.
            </p>
            <p className={fr.cx("fr-text--xs")}>
              Tous les champs marqués d'une astérisque (*) sont obligatoires.
            </p>
            <Input
              label="Adresse e-mail *"
              nativeInputProps={{
                ...register("recipientEmail"),
                id: domElementIds.conventionTemplate.shareAsConventionDraft
                  .emailInput,
                type: "email",
                placeholder: "nom@exemple.com",
              }}
              state={formState.errors.recipientEmail ? "error" : "default"}
              stateRelatedMessage={formState.errors.recipientEmail?.message}
            />
            <Input
              className={fr.cx("fr-mt-2w")}
              label="Votre message"
              nativeTextAreaProps={{
                ...register("details", {
                  setValueAs: setValueAsUndefined,
                }),
                id: domElementIds.conventionTemplate.shareAsConventionDraft
                  .messageInput,
              }}
              textArea
              state={formState.errors.details ? "error" : "default"}
              stateRelatedMessage={formState.errors.details?.message}
            />
          </form>
        </shareConventionTemplateModal.Component>,
        document.body,
      )}
    </>
  );
};
