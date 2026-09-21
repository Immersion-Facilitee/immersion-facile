import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import Stepper, { type StepperProps } from "@codegouvfr/react-dsfr/Stepper";
import { zodResolver } from "@hookform/resolvers/zod";
import { keys } from "ramda";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader, useScrollTo } from "react-design-system";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type DotNestedKeys,
  defaultCountryCode,
  domElementIds,
  errors,
  type FormEstablishmentDto,
  type FormEstablishmentUserRight,
  formEstablishmentSchema,
  type RangeOfPosition,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BusinessAndAdminSection } from "src/app/components/forms/establishment/sections/BusinessAndAdminSection";
import { OffersSection } from "src/app/components/forms/establishment/sections/OffersSection";
import { OffersSettingsSection } from "src/app/components/forms/establishment/sections/OffersSettingsSection";
import { SummarySection } from "src/app/components/forms/establishment/sections/SummarySection";
import { useGetAcquisitionParams } from "src/app/hooks/acquisition.hooks";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import { type Mode, useEstablishmentRoute } from "src/app/routes/routes.hooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionSlice } from "src/core-logic/domain/convention/convention.slice";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import { match, P } from "ts-pattern";

type EstablishmentFormProps = {
  mode: Mode;
};

type FormStep = RangeOfPosition<4>;

const steps: Record<FormStep, Pick<StepperProps, "title" | "nextTitle">> = {
  1: {
    title: "Votre établissement",
    nextTitle: "Vos offres",
  },
  2: {
    title: "Vos offres",
    nextTitle: "Paramètres de vos offres",
  },
  3: {
    title: "Paramètres de vos offres",
    nextTitle: "Récapitulatif de votre établissement",
  },
  4: {
    title: "Récapitulatif de votre établissement",
  },
};

export type FieldsToValidate = (
  | keyof FormEstablishmentDto
  | DotNestedKeys<FormEstablishmentDto>
)[];

export type Step = FormStep | null;
export type OnStepChange = (
  step: Step,
  fieldsToValidate: FieldsToValidate,
) => void;

export const EstablishmentForm = ({ mode }: EstablishmentFormProps) => {
  const dispatch = useDispatch();
  const route = useEstablishmentRoute();

  const isEstablishmentCreation = route.name === "formEstablishment";
  const isEstablishmentAdmin = route.name === "adminEstablishments";
  const isEstablishmentDashboard =
    route.name === "establishmentDashboardFormEstablishment";

  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const federatedIdentity = useAppSelector(authSelectors.federatedIdentity);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const establishmentFeedback = useFeedbackTopic("form-establishment");
  const isLoading = useAppSelector(establishmentSelectors.isLoading);
  const initialFormEstablishment = useAppSelector(
    establishmentSelectors.formEstablishment,
  );

  const initialUserRights:
    | [
        Omit<FormEstablishmentUserRight, "isMainContactByPhone"> & {
          isMainContactByPhone?: boolean | null;
        },
      ]
    | FormEstablishmentUserRight[] = useMemo(
    () =>
      mode === "create"
        ? [
            {
              email: currentUser?.email ?? "",
              job: "",
              status: "ACCEPTED",
              phone: "",
              isMainContactByPhone: true,
              role: "establishment-admin",
              shouldReceiveDiscussionNotifications: true,
            },
          ]
        : initialFormEstablishment.userRights,

    [federatedIdentity, initialFormEstablishment.userRights, mode],
  );

  const [availableForImmersion, setAvailableForImmersion] = useState<
    boolean | undefined
  >(undefined);

  const [currentStep, setCurrentStep] = useState<Step>(
    isEstablishmentAdmin || isEstablishmentDashboard ? null : 1,
  );
  const acquisitionParams = useGetAcquisitionParams();

  const siretFromFederatedIdentity =
    !initialFormEstablishment.siret && currentUser?.proConnect
      ? currentUser.proConnect.siret
      : initialFormEstablishment.siret;

  const defaultFormValues = useMemo(
    () => ({
      ...initialFormEstablishment,
      ...acquisitionParams,
      maxContactsPerMonth: undefined,
      userRights: initialUserRights,
      siret: siretFromFederatedIdentity,
    }),
    [
      initialFormEstablishment,
      acquisitionParams,
      initialUserRights,
      siretFromFederatedIdentity,
    ],
  );

  const initialCurrentRoute = useRef(route).current;
  const currentRoute = isEstablishmentDashboard ? route : initialCurrentRoute;

  const shouldUpdateAvailability =
    route.name === "establishmentDashboardFormEstablishment"
      ? Boolean(route.params.shouldUpdateAvailability)
      : undefined;

  const methods = useForm<FormEstablishmentDto>({
    defaultValues: defaultFormValues,
    resolver: zodResolver(formEstablishmentSchema),
    mode: "onTouched",
  });
  const { handleSubmit, getValues, reset, trigger } = methods;
  const siret = getValues("siret");
  const currentSiret = useAppSelector(siretSelectors.currentSiret);
  const shouldFetch = mode === "create";
  const shouldUpdateSiret = useMemo(
    () => shouldFetch && siret.length > 0 && siret !== currentSiret,
    [siret, currentSiret, shouldFetch],
  );

  useEffect(() => {
    if (shouldUpdateSiret) {
      dispatch(
        siretSlice.actions.siretModified({
          siret,
          feedbackTopic: "siret-input",
          addressAutocompleteLocator: "multiple-address-0",
        }),
      );
    }
  }, [siret, dispatch, shouldUpdateSiret]);

  useScrollTo(establishmentFeedback?.level === "success" || currentStep);

  useEffect(() => {
    match({
      route: currentRoute,
      connectedUserJwt,
    })
      .with(
        {
          route: {
            name: "formEstablishment",
          },
        },
        ({ route, connectedUserJwt }) => {
          if (
            mode === "create" &&
            connectedUserJwt &&
            route.params.fromConventionId
          ) {
            dispatch(
              conventionSlice.actions.fetchConventionRequested({
                conventionId: route.params.fromConventionId,
                jwt: connectedUserJwt,
                feedbackTopic: "form-establishment",
              }),
            );
          }
        },
      )
      .with(
        {
          route: { name: "adminEstablishments" },
          connectedUserJwt: P.nullish,
        },
        () => {
          throw errors.user.notBackOfficeAdmin();
        },
      )
      .with(
        {
          route: { name: "adminEstablishments", params: { siret: P.string } },
          connectedUserJwt: P.not(P.nullish),
        },
        ({ route, connectedUserJwt }) =>
          dispatch(
            establishmentSlice.actions.fetchEstablishmentRequested({
              establishmentRequested: {
                siret: route.params.siret,
                jwt: connectedUserJwt,
              },
              feedbackTopic: "form-establishment",
            }),
          ),
      )
      .with(
        {
          route: { name: "adminEstablishments", params: { siret: P.nullish } },
          connectedUserJwt: P.not(P.nullish),
        },
        () => undefined,
      )
      .with(
        {
          route: {
            name: "establishmentDashboardFormEstablishment",
            params: { siret: P.string },
          },
          connectedUserJwt: P.not(P.nullish),
        },
        ({ route, connectedUserJwt }) =>
          dispatch(
            establishmentSlice.actions.fetchEstablishmentRequested({
              establishmentRequested: {
                siret: route.params.siret,
                jwt: connectedUserJwt,
              },
              feedbackTopic: "form-establishment",
            }),
          ),
      )
      .with(
        {
          route: {
            name: "establishmentDashboardFormEstablishment",
            params: { siret: P.nullish },
          },
          connectedUserJwt: P.not(P.nullish),
        },
        () => undefined,
      )
      .with(
        {
          route: { name: "establishmentDashboardFormEstablishment" },
          connectedUserJwt: P.nullish,
        },
        () => {
          throw errors.user.unauthorized();
        },
      )
      .exhaustive();
  }, [dispatch, connectedUserJwt, currentRoute]);

  useEffect(() => {
    reset({
      ...defaultFormValues,
      maxContactsPerMonth:
        mode === "create"
          ? undefined
          : initialFormEstablishment.maxContactsPerMonth,
    });
  }, [defaultFormValues, reset, mode, initialFormEstablishment]);

  useEffect(() => {
    if (!isEstablishmentCreation) {
      initialFormEstablishment.businessAddresses.forEach((address, index) => {
        dispatch(
          geocodingSlice.actions.fetchSuggestionsRequested({
            locator: `multiple-address-${index}`,
            lookup: address.rawAddress,
            countryCode: defaultCountryCode,
            selectFirstSuggestion: true,
          }),
        );
      });
    }
  }, [isEstablishmentCreation, initialFormEstablishment, dispatch]);

  useEffect(
    () => () => {
      dispatch(establishmentSlice.actions.clearEstablishmentRequested());
    },
    [dispatch],
  );

  const onSubmit: SubmitHandler<FormEstablishmentDto> = (formEstablishment) =>
    match({ route, connectedUserJwt })
      .with(
        {
          route: {
            name: "formEstablishment",
          },
          connectedUserJwt: P.not(P.nullish),
        },
        ({ connectedUserJwt }) =>
          dispatch(
            establishmentSlice.actions.createEstablishmentRequested({
              formEstablishment,
              feedbackTopic: "form-establishment",
              jwt: connectedUserJwt,
            }),
          ),
      )
      .with(
        {
          route: { name: "adminEstablishments" },
          connectedUserJwt: P.nullish,
        },
        () => {
          throw frontErrors.generic.unauthorized();
        },
      )
      .with(
        {
          route: { name: "adminEstablishments" },
          connectedUserJwt: P.not(P.nullish),
        },
        ({ connectedUserJwt }) =>
          dispatch(
            establishmentSlice.actions.updateEstablishmentRequested({
              establishmentUpdate: {
                formEstablishment,
                jwt: connectedUserJwt,
              },
              feedbackTopic: "form-establishment",
            }),
          ),
      )
      .with(
        {
          route: { name: "establishmentDashboardFormEstablishment" },
          connectedUserJwt: P.not(P.nullish),
        },
        ({ connectedUserJwt }) =>
          dispatch(
            establishmentSlice.actions.updateEstablishmentRequested({
              establishmentUpdate: {
                formEstablishment,
                jwt: connectedUserJwt,
              },
              feedbackTopic: "form-establishment",
            }),
          ),
      )
      .with(
        {
          route: {
            name: "formEstablishment",
          },
          connectedUserJwt: P.nullish,
        },
        () => {
          throw frontErrors.generic.unauthorized();
        },
      )

      .with(
        {
          route: { name: "establishmentDashboardFormEstablishment" },
          connectedUserJwt: P.nullish,
        },
        () => {
          throw new Error("Accès interdit sans être connecté.");
        },
      )
      .exhaustive();

  const onStepChange: OnStepChange = async (targetStep, fieldsToValidate) => {
    if (targetStep && currentStep && targetStep < currentStep) {
      setCurrentStep(targetStep);
      return;
    }
    await validateEstablishmentFormFields({
      fieldsToValidate,
      trigger,
      onSuccess: () => {
        if (
          currentStep === 3 &&
          availableForImmersion === undefined &&
          mode === "create"
        )
          return;
        setCurrentStep(targetStep);
      },
    });
  };

  return (
    <WithFeedbackReplacer
      topic="form-establishment"
      renderFeedback={() => (
        <>
          <Feedback topics={["form-establishment"]} />
          {mode !== "create" && (
            <Button
              onClick={() => {
                dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
              }}
              className={fr.cx("fr-mt-2w")}
              size="small"
              type="button"
              priority="secondary"
            >
              Revenir à la fiche entreprise
            </Button>
          )}
        </>
      )}
    >
      {/** biome-ignore lint/complexity/noUselessFragments: BUG BIOME */}
      <>
        {isLoading && <Loader />}
        <FormProvider {...methods}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            id={domElementIds.formEstablishment[mode].form}
          >
            {match(currentStep)
              .with(null, () => (
                <>
                  {currentUser?.isBackofficeAdmin &&
                    initialFormEstablishment.isEstablishmentBanned && (
                      <Badge severity="error" className={fr.cx("fr-mb-2w")}>
                        ENTREPRISE BANNIE
                      </Badge>
                    )}
                  <BusinessAndAdminSection
                    mode={mode}
                    onStepChange={onStepChange}
                    currentStep={currentStep}
                  />
                  <OffersSection
                    mode={mode}
                    onStepChange={onStepChange}
                    currentStep={currentStep}
                  />
                  <OffersSettingsSection
                    mode={mode}
                    onStepChange={onStepChange}
                    currentStep={currentStep}
                    availableForImmersion={availableForImmersion}
                    setAvailableForImmersion={setAvailableForImmersion}
                    shouldUpdateAvailability={shouldUpdateAvailability}
                  />
                </>
              ))
              .otherwise((currentStep) => (
                <div className={fr.cx("fr-col")}>
                  <Stepper
                    currentStep={currentStep}
                    stepCount={keys(steps).length}
                    title={steps[currentStep].title}
                    nextTitle={steps[currentStep].nextTitle}
                  />
                  {match(currentStep)
                    // TODO : remettre ordre
                    .with(1, () => (
                      <BusinessAndAdminSection
                        mode={mode}
                        currentStep={currentStep}
                        onStepChange={onStepChange}
                      />
                    ))
                    .with(2, () => (
                      <OffersSection
                        mode={mode}
                        onStepChange={onStepChange}
                        currentStep={currentStep}
                      />
                    ))
                    .with(3, () => (
                      <OffersSettingsSection
                        mode={mode}
                        onStepChange={onStepChange}
                        currentStep={currentStep}
                        availableForImmersion={availableForImmersion}
                        setAvailableForImmersion={setAvailableForImmersion}
                        shouldUpdateAvailability={shouldUpdateAvailability}
                      />
                    ))
                    .with(4, () => (
                      <SummarySection
                        mode={mode}
                        onStepChange={onStepChange}
                        currentStep={currentStep}
                        isEstablishmentAdmin={isEstablishmentAdmin}
                      />
                    ))
                    .exhaustive()}
                </div>
              ))}
          </form>
        </FormProvider>
      </>
    </WithFeedbackReplacer>
  );
};

export const validateEstablishmentFormFields = async ({
  fieldsToValidate,
  trigger,
  onSuccess,
}: {
  fieldsToValidate: FieldsToValidate;
  trigger: (
    field: keyof FormEstablishmentDto | DotNestedKeys<FormEstablishmentDto>,
  ) => Promise<boolean>;
  onSuccess: () => void;
}) => {
  const validatedFields = await Promise.all(
    fieldsToValidate.map((field) => trigger(field)),
  );
  if (validatedFields.every((validatedField) => validatedField)) {
    onSuccess();
  }
};
