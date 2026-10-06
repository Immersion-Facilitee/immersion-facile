import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { addYears } from "date-fns";
import { Fragment, useEffect, useState } from "react";
import { ResponsiveTable, useCopyButton } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type ApiConsumer,
  type ApiConsumerJwt,
  domElementIds,
  toDateUTCString,
  toDisplayedDate,
} from "shared";
import { ApiConsumerForm } from "src/app/components/admin/technical-options/ApiConsumerForm";
import { Feedback } from "src/app/components/feedback/Feedback";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import {
  formatApiConsumerContact,
  formatApiConsumerDescription,
  formatApiConsumerName,
  formatApiConsumerRights,
  makeApiConsumerActionButtons,
} from "src/app/contents/admin/apiConsumer";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  buttonsToModalButtons,
  createFormModal,
  defaultCancelButton,
  defaultSubmitButton,
} from "src/app/utils/createFormModal";
import { apiConsumerSelectors } from "src/core-logic/domain/apiConsumer/apiConsumer.selector";
import { apiConsumerSlice } from "src/core-logic/domain/apiConsumer/apiConsumer.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { v4 as uuidV4 } from "uuid";

const submitButtonId = {
  id: domElementIds.admin.technicalOptionsTab.apiConsumerSubmitButton,
};

export const apiConsumerModal = createFormModal({
  id: domElementIds.admin.technicalOptionsTab.apiConsumerModal,
  isOpenedByDefault: false,
  formId: domElementIds.admin.technicalOptionsTab.apiConsumerForm,
});

const revokeApiConsumerModal = createModal({
  id: domElementIds.admin.technicalOptionsTab.revokeApiConsumerModal,
  isOpenedByDefault: false,
});

const renewApiConsumerKeyModal = createModal({
  id: domElementIds.admin.technicalOptionsTab.renewApiConsumerKeyModal,
  isOpenedByDefault: false,
});

export const ApiConsumersSection = () => {
  const isApiConsumerModalOpened = useIsModalOpen({
    id: domElementIds.admin.technicalOptionsTab.apiConsumerModal,
    isOpenedByDefault: false,
  });
  const apiConsumers = useAppSelector(apiConsumerSelectors.apiConsumers);
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const feedback = useFeedbackTopic("api-consumer-global");
  const renewFeedback = useFeedbackTopic("api-consumer-renew");
  const revokeFeedback = useFeedbackTopic("api-consumer-revoke");
  const isConsumerAdded =
    feedback?.on === "create" && feedback?.level === "success";
  const isKeyRenewed =
    renewFeedback?.on === "create" && renewFeedback?.level === "success";
  const isRevoked =
    revokeFeedback?.on === "create" && revokeFeedback?.level === "success";
  const [apiConsumerToActOn, setApiConsumerToActOn] =
    useState<ApiConsumer | null>(null);

  useEffect(() => {
    connectedUserJwt &&
      dispatch(
        apiConsumerSlice.actions.retrieveApiConsumersRequested(
          connectedUserJwt,
        ),
      );
    return () => {
      dispatch(apiConsumerSlice.actions.clearApiConsumersRequested());
    };
  }, [connectedUserJwt, dispatch]);

  useEffect(() => {
    if (isApiConsumerModalOpened) return;
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    dispatch(apiConsumerSlice.actions.clearLastCreatedToken());
    connectedUserJwt &&
      dispatch(
        apiConsumerSlice.actions.retrieveApiConsumersRequested(
          connectedUserJwt,
        ),
      );
  }, [isApiConsumerModalOpened, dispatch, connectedUserJwt]);

  const [currentApiConsumerToEdit, setCurrentApiConsumerToEdit] =
    useState<ApiConsumer>(defaultApiConsumerValues(uuidV4()));
  const onApiConsumerAddClick = () => {
    setCurrentApiConsumerToEdit(defaultApiConsumerValues(uuidV4()));
    apiConsumerModal.open();
  };

  const onEditButtonClick = (apiConsumer: ApiConsumer) => {
    setCurrentApiConsumerToEdit({
      ...apiConsumer,
      expirationDate: toDateUTCString(new Date(apiConsumer.expirationDate)),
      createdAt: toDateUTCString(new Date(apiConsumer.createdAt)),
    });
    apiConsumerModal.open();
  };

  const onConfirmTokenModalClose = () => {
    dispatch(apiConsumerSlice.actions.clearLastCreatedToken());
    connectedUserJwt &&
      dispatch(
        apiConsumerSlice.actions.retrieveApiConsumersRequested(
          connectedUserJwt,
        ),
      );
    apiConsumerModal.close();
  };

  const onRevokeClick = (apiConsumer: ApiConsumer) => {
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    setApiConsumerToActOn(apiConsumer);
    revokeApiConsumerModal.open();
  };

  const onRenewKeyClick = (apiConsumer: ApiConsumer) => {
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    dispatch(apiConsumerSlice.actions.clearLastCreatedToken());
    setApiConsumerToActOn(apiConsumer);
    renewApiConsumerKeyModal.open();
  };

  const onConfirmRevoke = () => {
    if (!connectedUserJwt || !apiConsumerToActOn) return;
    dispatch(
      apiConsumerSlice.actions.revokeApiConsumerRequested({
        apiConsumerId: apiConsumerToActOn.id,
        adminToken: connectedUserJwt,
        feedbackTopic: "api-consumer-revoke",
      }),
    );
  };

  const onConfirmRenewKey = () => {
    if (!connectedUserJwt || !apiConsumerToActOn) return;
    dispatch(
      apiConsumerSlice.actions.renewApiConsumerKeyRequested({
        apiConsumerId: apiConsumerToActOn.id,
        adminToken: connectedUserJwt,
        feedbackTopic: "api-consumer-renew",
      }),
    );
  };

  const onRevokeModalClose = () => {
    revokeApiConsumerModal.close();
    setApiConsumerToActOn(null);
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    connectedUserJwt &&
      dispatch(
        apiConsumerSlice.actions.retrieveApiConsumersRequested(
          connectedUserJwt,
        ),
      );
  };

  const onRenewKeyModalClose = () => {
    renewApiConsumerKeyModal.close();
    setApiConsumerToActOn(null);
    dispatch(apiConsumerSlice.actions.clearLastCreatedToken());
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    connectedUserJwt &&
      dispatch(
        apiConsumerSlice.actions.retrieveApiConsumersRequested(
          connectedUserJwt,
        ),
      );
  };

  const lastCreatedToken = useAppSelector(
    apiConsumerSelectors.lastCreatedToken,
  );

  const sortedApiConsumers = [...apiConsumers].sort(
    (apiConsumer1, apiConsumer2) =>
      new Date(apiConsumer2.createdAt).getTime() -
      new Date(apiConsumer1.createdAt).getTime(),
  );

  const tableDataFromApiConsumers = sortedApiConsumers.map((apiConsumer) => [
    formatApiConsumerName(
      apiConsumer.id,
      apiConsumer.name,
      apiConsumer.revokedAt,
    ),
    formatApiConsumerDescription(apiConsumer.description),
    toDisplayedDate({
      date: new Date(apiConsumer.expirationDate),
      withHours: true,
    }),
    formatApiConsumerContact(apiConsumer.contact),
    formatApiConsumerRights(apiConsumer.rights),
    makeApiConsumerActionButtons(apiConsumer, {
      onEdit: onEditButtonClick,
      onRevoke: onRevokeClick,
      onRenewKey: onRenewKeyClick,
    }),
  ]);

  const closeButton: ButtonProps = {
    children: "Fermer la fenêtre",
    type: "button",
    priority: "primary",
    onClick: apiConsumerModal.close,
  };

  const customModalButtons: ButtonProps[] = isConsumerAdded
    ? [closeButton]
    : [defaultCancelButton, { ...defaultSubmitButton, id: submitButtonId.id }];

  return (
    <BackofficeDashboardTabContent
      title="Consommateurs API"
      titleAction={
        <Button
          type="button"
          onClick={onApiConsumerAddClick}
          id={domElementIds.admin.technicalOptionsTab.addApiConsumerButton}
        >
          Ajouter un nouveau consommateur
        </Button>
      }
      className={fr.cx("fr-mt-4w")}
    >
      <ResponsiveTable
        data={tableDataFromApiConsumers}
        headers={[
          "Id (Nom)",
          "Description",
          "Date d'expiration",
          "Contact",
          "Droits",
          "Actions",
        ]}
      />
      {createPortal(
        <apiConsumerModal.Component
          title="Ajout consommateur api"
          concealingBackdrop
          buttons={buttonsToModalButtons(customModalButtons)}
          doSubmitClosesModal={false}
        >
          <WithFeedbackReplacer
            topic="api-consumer-global"
            renderFeedback={({ level }) => (
              <Fragment key={`${level}-${currentApiConsumerToEdit.id}`}>
                {level === "success" && lastCreatedToken && (
                  <ShowApiKeyToCopy
                    lastCreatedToken={lastCreatedToken}
                    onConfirmTokenModalClose={onConfirmTokenModalClose}
                  />
                )}
                {level === "success" && !lastCreatedToken && (
                  <Feedback topics={["api-consumer-global"]} />
                )}
              </Fragment>
            )}
          >
            <ApiConsumerForm initialValues={currentApiConsumerToEdit} />
          </WithFeedbackReplacer>
        </apiConsumerModal.Component>,
        document.body,
      )}
      {createPortal(
        <revokeApiConsumerModal.Component
          title="Révoquer le consommateur API"
          concealingBackdrop
          buttons={
            isRevoked
              ? [
                  {
                    children: "Fermer",
                    type: "button",
                    priority: "primary",
                    onClick: onRevokeModalClose,
                  },
                ]
              : [
                  {
                    children: "Annuler",
                    type: "button",
                    priority: "secondary",
                    doClosesModal: false,
                    onClick: onRevokeModalClose,
                  },
                  {
                    children: "Révoquer",
                    type: "button",
                    priority: "primary",
                    doClosesModal: false,
                    onClick: onConfirmRevoke,
                  },
                ]
          }
        >
          <Feedback topics={["api-consumer-revoke"]} />
          {apiConsumerToActOn && !isRevoked && (
            <Alert
              severity="warning"
              title="Action irréversible"
              description={`Vous êtes sur le point de révoquer le consommateur "${apiConsumerToActOn.name}". Cette action est permanente et le consommateur ne pourra plus utiliser l'API.`}
            />
          )}
        </revokeApiConsumerModal.Component>,
        document.body,
      )}
      {createPortal(
        <renewApiConsumerKeyModal.Component
          title={
            apiConsumerToActOn?.revokedAt
              ? "Réactiver le consommateur API"
              : "Renouveler la clé API"
          }
          concealingBackdrop
          buttons={
            isKeyRenewed && lastCreatedToken
              ? undefined
              : [
                  {
                    children: "Annuler",
                    type: "button",
                    priority: "secondary",
                    doClosesModal: false,
                    onClick: onRenewKeyModalClose,
                  },
                  {
                    children: apiConsumerToActOn?.revokedAt
                      ? "Réactiver"
                      : "Renouveler",
                    type: "button",
                    priority: "primary",
                    doClosesModal: false,
                    onClick: onConfirmRenewKey,
                  },
                ]
          }
        >
          {isKeyRenewed && lastCreatedToken ? (
            <ShowApiKeyToCopy
              lastCreatedToken={lastCreatedToken}
              onConfirmTokenModalClose={onRenewKeyModalClose}
            />
          ) : (
            <>
              <Feedback topics={["api-consumer-renew"]} />
              {apiConsumerToActOn && (
                <Alert
                  severity={apiConsumerToActOn.revokedAt ? "info" : "warning"}
                  title={
                    apiConsumerToActOn.revokedAt ? "Réactivation" : "Attention"
                  }
                  description={
                    apiConsumerToActOn.revokedAt
                      ? `Vous êtes sur le point de réactiver le consommateur "${apiConsumerToActOn.name}". Une nouvelle clé API sera générée et le consommateur pourra à nouveau utiliser l'API.`
                      : `Vous êtes sur le point de renouveler la clé API pour "${apiConsumerToActOn.name}". L'ancienne clé sera immédiatement invalidée. Assurez-vous de transmettre la nouvelle clé au consommateur.`
                  }
                />
              )}
            </>
          )}
        </renewApiConsumerKeyModal.Component>,
        document.body,
      )}
    </BackofficeDashboardTabContent>
  );
};

const ShowApiKeyToCopy = ({
  lastCreatedToken,
  onConfirmTokenModalClose,
}: {
  lastCreatedToken: ApiConsumerJwt;
  onConfirmTokenModalClose: () => void;
}) => {
  const { copyButtonIsDisabled, copyButtonLabel, onCopyButtonClick } =
    useCopyButton("Copier la clé API");

  return (
    <>
      <Alert
        severity="success"
        title="Consommateur Api ajouté !"
        className={"fr-mb-2w"}
      />
      <Input
        textArea
        label="Token généré"
        hintText="Ce token est à conserver précieusement, il ne sera plus affiché par la suite."
        nativeTextAreaProps={{
          readOnly: true,
          value: lastCreatedToken,
          rows: 5,
        }}
      />

      <ButtonsGroup
        buttons={[
          {
            type: "button",
            children: copyButtonLabel,
            priority: "secondary",
            disabled: copyButtonIsDisabled,
            onClick: () => {
              onCopyButtonClick(lastCreatedToken);
            },
          },
          {
            type: "button",
            children: "J'ai bien copié le token, je peux fermer la fenêtre",
            onClick: onConfirmTokenModalClose,
          },
        ]}
      />
    </>
  );
};

const defaultApiConsumerValues = (id: string): ApiConsumer => ({
  id,
  name: "",
  contact: {
    lastName: "",
    firstName: "",
    job: "",
    phone: "",
    emails: [],
  },
  rights: {
    searchEstablishment: {
      kinds: [],
      scope: "no-scope",
      subscriptions: [],
    },
    convention: {
      kinds: [],
      scope: {
        agencyKinds: [],
      },
      subscriptions: [],
    },
    statistics: {
      kinds: ["READ"],
      scope: "no-scope",
      subscriptions: [],
    },
  },
  createdAt: toDateUTCString(new Date()),
  expirationDate: toDateUTCString(addYears(new Date(), 1)),
  revokedAt: null,
  currentKeyIssuedAt: new Date().toISOString(),
});
