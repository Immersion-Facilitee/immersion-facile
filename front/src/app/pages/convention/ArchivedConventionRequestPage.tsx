import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import Select from "@codegouvfr/react-dsfr/SelectNext";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, PageHeader, useScrollTo } from "react-design-system";
import { type DefaultValues, FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type ArchivedConventionRequestDto,
  archivedConventionRequestSchema,
  domElementIds,
  frontRoutes,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { FullPageFeedback } from "src/app/components/feedback/FullpageFeedback";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";
import { archiveReasonOptions } from "src/app/contents/convention-archive/conventionArchive.helpers";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { ConnectedPrivateRoutePage } from "src/app/pages/auth/ConnectedPrivateRoutePage";
import { commonIllustrations } from "src/assets/img/illustrations";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { archivedConventionRequestSelectors } from "src/core-logic/domain/convention/archivedConventionRequest.selectors";
import { archivedConventionRequestSlice } from "src/core-logic/domain/convention/archivedConventionRequest.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";
import { v4 as uuidV4 } from "uuid";

type ArchivedConventionRequestPageProps = {
  route: Route<typeof frontRoutes.archivedConventionRequest>;
};

const initialValues = ({
  id,
  conventionId,
}: {
  id: string;
  conventionId?: string;
}): DefaultValues<ArchivedConventionRequestDto> => ({
  id,
  conventionSearchMethod: "withConventionId",
  conventionId: conventionId ?? "",
});

export const ArchivedConventionRequestPage = ({
  route,
}: ArchivedConventionRequestPageProps) => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const isLoading = useAppSelector(
    archivedConventionRequestSelectors.isLoading,
  );
  const methods = useForm<ArchivedConventionRequestDto>({
    resolver: zodResolver(archivedConventionRequestSchema),
    mode: "onTouched",
    defaultValues: initialValues({
      id: uuidV4(),
      conventionId: route.params.conventionId,
    }),
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = methods;
  const conventionSearchMethod = watch("conventionSearchMethod");
  const reason = watch("reason");
  const feedback = useFeedbackTopic("archived-convention-request");

  useScrollTo(!!feedback);

  const onSubmit = (values: ArchivedConventionRequestDto) => {
    if (!connectedUserJwt) return;

    dispatch(
      archivedConventionRequestSlice.actions.saveArchivedConventionRequestRequested(
        {
          archivedConventionRequest: values,
          jwt: connectedUserJwt,
          feedbackTopic: "archived-convention-request",
        },
      ),
    );
  };

  return (
    <ConnectedPrivateRoutePage
      route={route}
      oAuthConnectionPageHeader={
        <PageHeader title="Vous devez vous connecter pour accéder à une convention archivée" />
      }
    >
      <WithFeedbackReplacer
        topic="archived-convention-request"
        renderFeedback={({ level }) =>
          level === "success" ? (
            <FullPageFeedback
              includeWrapper={false}
              title="Demande envoyée avec succès"
              illustration={commonIllustrations.success}
              content={
                <>
                  <p>Votre demande d'accès a bien été enregistrée.</p>
                  <p>
                    Notre équipe va examiner votre demande pour s'assurer que
                    nous pouvons vous transmettre ces documents de manière
                    légitime.
                  </p>
                  <p>
                    Si votre demande est validée, la convention ainsi que le
                    bilan d'immersion vous seront envoyés directement par email
                    d'ici quelques jours.
                  </p>
                </>
              }
              buttons={[
                {
                  id: domElementIds.archivedConventionRequest.success
                    .goToMyAccountButton,
                  children: "Retourner à l'accueil",
                  priority: "primary",
                  linkProps: frontRoutes.home().link,
                },
                {
                  id: domElementIds.archivedConventionRequest.success
                    .newRequestButton,
                  children: "Faire une autre demande",
                  priority: "secondary",
                  onClick: () => {
                    reset(initialValues({ id: uuidV4() }));
                    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
                  },
                },
              ]}
            />
          ) : (
            <Feedback topics={["archived-convention-request"]} />
          )
        }
      >
        {isLoading && <Loader />}
        <h1>Demande d'accès à une convention archivée</h1>
        <p className={fr.cx("fr-text--lead")}>
          Les conventions de plus de 2 ans sont automatiquement archivées. Pour
          des raisons légales ou de suivi, vous pouvez demander la récupération
          d'une convention et de son bilan.
        </p>
        <FormProvider {...methods}>
          <form
            id={domElementIds.archivedConventionRequest.form}
            onSubmit={handleSubmit(onSubmit)}
          >
            <input type="hidden" {...register("id")} />
            <h2 className={fr.cx("fr-h6", "fr-mt-4w")}>
              Données de la convention
            </h2>
            <p>
              Renseignez l'identifiant exact de la convention ou les
              informations détaillées permettant à notre équipe de la retrouver.
            </p>
            <RadioButtons
              id={
                domElementIds.archivedConventionRequest.conventionSearchMethod
              }
              legend="Informations disponibles"
              options={[
                {
                  label: "Je connais l'identifiant de la convention",
                  nativeInputProps: {
                    value: "withConventionId",
                    ...register("conventionSearchMethod"),
                  },
                },
                {
                  label: "Je ne connais pas l'identifiant de la convention",
                  nativeInputProps: {
                    value: "withConventionDetails",
                    ...register("conventionSearchMethod"),
                  },
                },
              ]}
              state={errors.conventionSearchMethod ? "error" : "default"}
              stateRelatedMessage={errors.conventionSearchMethod?.message}
            />
            {conventionSearchMethod === "withConventionId" ? (
              <Input
                label="ID de la convention *"
                nativeInputProps={{
                  id: domElementIds.archivedConventionRequest.conventionIdInput,
                  ...register("conventionId"),
                }}
                state={errors.conventionId ? "error" : "default"}
                stateRelatedMessage={errors.conventionId?.message}
              />
            ) : (
              <>
                <Input
                  label="Nom du bénéficiaire *"
                  nativeInputProps={{
                    id: domElementIds.archivedConventionRequest
                      .beneficiaryLastNameInput,
                    ...register("beneficiaryLastName"),
                  }}
                  state={errors.beneficiaryLastName ? "error" : "default"}
                  stateRelatedMessage={errors.beneficiaryLastName?.message}
                />
                <Input
                  label="Prénom du bénéficiaire *"
                  nativeInputProps={{
                    id: domElementIds.archivedConventionRequest
                      .beneficiaryFirstNameInput,
                    ...register("beneficiaryFirstName"),
                  }}
                  state={errors.beneficiaryFirstName ? "error" : "default"}
                  stateRelatedMessage={errors.beneficiaryFirstName?.message}
                />
                <Input
                  label="SIRET de l'entreprise *"
                  hintText={
                    <>
                      Vous pouvez le retrouver sur{" "}
                      <a
                        href="https://annuaire-entreprises.data.gouv.fr/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        l'annuaire des entreprises
                      </a>
                      .
                    </>
                  }
                  nativeInputProps={{
                    id: domElementIds.archivedConventionRequest.siretInput,
                    ...register("siret"),
                  }}
                  state={errors.siret ? "error" : "default"}
                  stateRelatedMessage={errors.siret?.message}
                />
                <Input
                  label="Date estimée de l'immersion *"
                  nativeInputProps={{
                    id: domElementIds.archivedConventionRequest
                      .immersionDateInput,
                    ...register("immersionDate"),
                  }}
                  state={errors.immersionDate ? "error" : "default"}
                  stateRelatedMessage={errors.immersionDate?.message}
                />
                <div className={fr.cx("fr-input-group")}>
                  <AppellationAutocomplete
                    locator="archived-convention-request"
                    label="Métier *"
                    onAppellationSelected={(appellation) => {
                      setValue("immersionAppellation", appellation, {
                        shouldValidate: true,
                      });
                    }}
                    onAppellationClear={() => {
                      setValue("immersionAppellation", undefined, {
                        shouldValidate: true,
                      });
                    }}
                    selectProps={{
                      inputId:
                        domElementIds.archivedConventionRequest
                          .appellationAutocomplete,
                    }}
                    state={errors.immersionAppellation ? "error" : undefined}
                    stateRelatedMessage={errors.immersionAppellation?.message}
                  />
                </div>
              </>
            )}
            <Select
              label="Raison de la demande *"
              placeholder="Sélectionner un motif"
              options={archiveReasonOptions}
              nativeSelectProps={{
                id: domElementIds.archivedConventionRequest.reasonSelect,
                ...register("reason"),
              }}
              state={errors.reason ? "error" : "default"}
              stateRelatedMessage={errors.reason?.message}
            />
            {reason === "other" && (
              <Input
                label="Précisez le motif *"
                textArea
                nativeTextAreaProps={{
                  id: domElementIds.archivedConventionRequest.otherReasonInput,
                  ...register("otherReason"),
                }}
                state={errors.otherReason ? "error" : "default"}
                stateRelatedMessage={errors.otherReason?.message}
              />
            )}
            <Button
              type="submit"
              nativeButtonProps={{
                id: domElementIds.archivedConventionRequest.submitButton,
              }}
            >
              Envoyer la demande
            </Button>
          </form>
        </FormProvider>
      </WithFeedbackReplacer>
    </ConnectedPrivateRoutePage>
  );
};
