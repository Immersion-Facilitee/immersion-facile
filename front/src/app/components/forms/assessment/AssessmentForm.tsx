import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import Stepper, { type StepperProps } from "@codegouvfr/react-dsfr/Stepper";
import { zodResolver } from "@hookform/resolvers/zod";
import { keys } from "ramda";
import { useState } from "react";
import {
  ConventionJobAndObjective,
  ConventionTotalHours,
  useScrollTo,
} from "react-design-system";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AssessmentDto,
  type AssessmentFormDto,
  type AssessmentStatus,
  assessmentFormSchema,
  assessmentFormValuesToAssessmentDto,
  assessmentStatuses,
  type ConventionDto,
  type ConventionReadDto,
  computeTotalHours,
  convertLocaleDateToUtcTimezoneDate,
  type DotNestedKeys,
  domElementIds,
  type InternshipKind,
  type Role,
  toDateUTCString,
  toDisplayedDate,
  typeOfContracts,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { ImmersionDescription } from "src/app/components/forms/assessment/ImmersionDescription";
import { printWeekSchedule } from "src/app/contents/convention/conventionSummary.helpers";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { setValueAsNull } from "src/app/utils/form.utils";
import { commonIllustrations } from "src/assets/img/illustrations";
import { assessmentSelectors } from "src/core-logic/domain/assessment/assessment.selectors";
import { assessmentSlice } from "src/core-logic/domain/assessment/assessment.slice";
import { match } from "ts-pattern";

type AssessmentFormProperties = {
  convention: ConventionReadDto;
  jwt: string;
  currentUserRoles: Role[];
  onAssessmentSubmitted: (assessment: AssessmentDto) => void;
};

type Step = 1 | 2 | 3;

type AssessmentFormFieldPath =
  | keyof AssessmentFormDto
  | DotNestedKeys<AssessmentFormDto>;

export type OnStepChange = (
  step: Step,
  fieldsToValidate: AssessmentFormFieldPath[],
) => void;

const partialCompletionDetailsFields = [
  "partialCompletionDetails",
  "partialCompletionDetails.lastDayOfPresence",
  "partialCompletionDetails.numberOfMissedHours",
] as const satisfies ReadonlyArray<AssessmentFormFieldPath>;

const steps: Record<Step, Pick<StepperProps, "title" | "nextTitle">> = {
  1: {
    title: "Détails de l'immersion",
    nextTitle: "Résultats de l'immersion",
  },
  2: {
    title: "Résultats de l'immersion",
    nextTitle: "Commentaires et bilan",
  },
  3: {
    title: "Commentaires et bilan",
  },
};

export const AssessmentForm = ({
  convention,
  jwt,
  onAssessmentSubmitted,
}: AssessmentFormProperties): JSX.Element => {
  const dispatch = useDispatch();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  const initialValues: AssessmentFormDto = {
    conventionId: convention.id,
    status: null,
    endedWithAJob: null,
    typeOfContract: null,
    contractStartDate: null,
    establishmentFeedback: "",
    establishmentAdvices: "",
  };
  const methods = useForm<AssessmentFormDto>({
    resolver: zodResolver(assessmentFormSchema(convention)),
    mode: "onTouched",
    defaultValues: initialValues,
  });
  const { handleSubmit, trigger } = methods;

  const onSubmit = (values: AssessmentFormDto) => {
    if (values.status === null || values.endedWithAJob === null) {
      throw new Error(
        "Form validation failed: status or endedWithAJob is null",
      );
    }

    const assessment = assessmentFormValuesToAssessmentDto(values, convention);

    onAssessmentSubmitted?.(assessment);

    dispatch(
      assessmentSlice.actions.creationRequested({
        assessment,
        jwt,
        feedbackTopic: "assessment",
      }),
    );
  };
  const onStepChange: OnStepChange = async (step, fieldsToValidate) => {
    if (step && currentStep && step < currentStep) {
      setCurrentStep(step);
      return;
    }
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setCurrentStep(step);
  };
  useScrollTo(currentStep);

  return (
    <>
      <ImmersionDescription convention={convention} />
      <Feedback topics={["assessment"]} />
      <FormProvider {...methods}>
        <div className={fr.cx("fr-grid-row")}>
          <div className={fr.cx("fr-col-lg-7", "fr-col-12")}>
            <Stepper
              currentStep={currentStep}
              stepCount={keys(steps).length}
              title={steps[currentStep].title}
              nextTitle={steps[currentStep].nextTitle}
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          id={domElementIds.assessment.form}
        >
          {match(currentStep)
            .with(1, () => (
              <AssessmentStatusSection
                convention={convention}
                onStepChange={onStepChange}
              />
            ))
            .with(2, () => (
              <AssessmentContractSection
                convention={convention}
                onStepChange={onStepChange}
              />
            ))
            .with(3, () => (
              <AssessmentCommentsSection
                onStepChange={onStepChange}
                jobTitle={convention.immersionAppellation.appellationLabel}
                objective={convention.immersionObjective}
              />
            ))
            .exhaustive()}
        </form>
      </FormProvider>
    </>
  );
};

const wordingByInternshipKind: Record<
  InternshipKind,
  Record<AssessmentStatus, string>
> = {
  immersion: {
    COMPLETED: "Oui, l'immersion a eu lieu aux horaires prévus",
    PARTIALLY_COMPLETED:
      "Oui, mais les horaires ont changé (abandon en cours, absences, retards, etc.)",
    DID_NOT_SHOW: "Non, le candidat n'est jamais venu",
  },
  "mini-stage-cci": {
    COMPLETED: "Oui, le mini-stage a eu lieu aux horaires prévus",
    PARTIALLY_COMPLETED:
      "Oui, mais les horaires ont changé (abandon en cours, absences, retards, etc.)",
    DID_NOT_SHOW: "Non, le candidat n'est jamais venu",
  },
};

const getLabels = (
  internshipKind: InternshipKind,
): Record<AssessmentStatus, string> => ({
  COMPLETED: wordingByInternshipKind[internshipKind].COMPLETED,
  PARTIALLY_COMPLETED:
    wordingByInternshipKind[internshipKind].PARTIALLY_COMPLETED,
  DID_NOT_SHOW: wordingByInternshipKind[internshipKind].DID_NOT_SHOW,
});

const AssessmentStatusSection = ({
  convention,
  onStepChange,
}: {
  convention: ConventionDto;
  onStepChange: OnStepChange;
}) => {
  const { register, formState, watch, setValue, unregister } =
    useFormContext<AssessmentFormDto>();

  const getFieldError = makeFieldError(formState);

  const formValues = watch();

  const partialCompletionDetailsFormValue =
    formValues.status === "PARTIALLY_COMPLETED"
      ? formValues.partialCompletionDetails
      : null;

  const hasImmersionEndedEarly =
    partialCompletionDetailsFormValue?.lastDayOfPresence &&
    new Date(partialCompletionDetailsFormValue.lastDayOfPresence) <
      new Date(convention.dateEnd);

  const partialCompletionDetailsFieldError = getFieldError(
    "partialCompletionDetails",
  );

  const assessmentDto =
    formValues.status === null
      ? undefined
      : assessmentFormValuesToAssessmentDto(formValues, convention);

  const totalHours = computeTotalHours({
    convention: convention,
    lastDayOfPresence:
      assessmentDto?.status === "PARTIALLY_COMPLETED"
        ? assessmentDto.lastDayOfPresence
        : undefined,
    numberOfMissedHours:
      assessmentDto?.status === "PARTIALLY_COMPLETED"
        ? assessmentDto.numberOfMissedHours
        : 0,
    status: formValues.status,
  });

  return (
    <>
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-lg-7")}>
          <RadioButtons
            id={domElementIds.assessment.statusInput}
            legend="L'immersion a-t-elle été effectuée ? *"
            options={assessmentStatuses.map((value) => ({
              label: getLabels(convention.internshipKind)[value],
              nativeInputProps: {
                value,
                ...register("status"),
                onChange: (event) => {
                  const { value } = event.target;
                  if (value === "COMPLETED") {
                    unregister("partialCompletionDetails");
                  }
                  if (
                    value === "PARTIALLY_COMPLETED" ||
                    value === "COMPLETED"
                  ) {
                    setValue("establishmentAdvices", "");
                    setValue("establishmentFeedback", "");
                  }
                  if (value === "DID_NOT_SHOW") {
                    setValue("establishmentAdvices", "Non applicable");
                    setValue("establishmentFeedback", "Non applicable");
                    setValue("endedWithAJob", false);
                    unregister("partialCompletionDetails");
                  }
                  if (value === "PARTIALLY_COMPLETED") {
                    setValue("partialCompletionDetails", {
                      lastDayOfPresence: null,
                      numberOfMissedHours: null,
                      numberOfMissedMinutes: null,
                    });
                  }
                  setValue("status", value as AssessmentStatus);
                },
              },
            }))}
            {...getFieldError("status")}
          />
          {formValues.status === "PARTIALLY_COMPLETED" && (
            <fieldset
              className={
                partialCompletionDetailsFieldError?.state === "error"
                  ? "fr-fieldset fr-fieldset--error"
                  : "fr-fieldset"
              }
            >
              <div className={fr.cx("fr-fieldset__content")}>
                <Input
                  label="S’il y a eu une fin d’immersion anticipée, quelle a été la date du dernier jour de présence en entreprise ?"
                  hintText={`Date indiquée dans la convention : ${toDisplayedDate(
                    {
                      date: convertLocaleDateToUtcTimezoneDate(
                        new Date(convention.dateEnd),
                      ),
                    },
                  )}`}
                  nativeInputProps={{
                    type: "date",
                    ...register("partialCompletionDetails.lastDayOfPresence", {
                      setValueAs: setValueAsNull,
                    }),
                    id: domElementIds.assessment.lastDayOfPresenceInput,
                    min: toDateUTCString(new Date(convention.dateStart)),
                    max: toDateUTCString(new Date(convention.dateEnd)),
                  }}
                  {...getFieldError(
                    "partialCompletionDetails.lastDayOfPresence",
                  )}
                />

                {hasImmersionEndedEarly && (
                  <Alert
                    className={fr.cx("fr-mb-2w")}
                    description="Vous avez indiqué que l’immersion s’est terminée plus tôt que
                prévu. Le total d’heures réalisées a été ajusté automatiquement."
                    severity="info"
                    small
                  />
                )}

                <p className={fr.cx("fr-mb-2v")}>
                  Pendant les jours réels de présence, combien d'heures ont été
                  manquées en raison d’absences ou de retards ?
                </p>

                <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
                  <Input
                    className={fr.cx("fr-col-12", "fr-col-sm-6")}
                    label="Heures manquées"
                    nativeInputProps={{
                      ...register(
                        "partialCompletionDetails.numberOfMissedHours",
                        {
                          setValueAs: (value: string) =>
                            value === "" ? null : +value,
                        },
                      ),
                      min: 0,
                      max: convention.schedule.totalHours,
                      pattern: "\\d*",
                      type: "number",
                      id: domElementIds.assessment.numberOfMissedHoursInput,
                    }}
                    {...getFieldError(
                      "partialCompletionDetails.numberOfMissedHours",
                    )}
                  />
                  <Input
                    className={fr.cx("fr-col-12", "fr-col-sm-6")}
                    label="Minutes manquées"
                    nativeInputProps={{
                      ...register(
                        "partialCompletionDetails.numberOfMissedMinutes",
                        {
                          setValueAs: (value: string) =>
                            value === "" ? null : +value,
                        },
                      ),
                      min: 0,
                      max: 60,
                      pattern: "\\d*",
                      type: "number",
                      id: domElementIds.assessment.numberOfMissedMinutesInput,
                    }}
                    {...getFieldError(
                      "partialCompletionDetails.numberOfMissedHours",
                    )}
                  />
                </div>
              </div>
              {partialCompletionDetailsFieldError?.stateRelatedMessage && (
                <p
                  id={domElementIds.assessment.partialCompletionDetailsError}
                  className={fr.cx("fr-error-text")}
                >
                  {partialCompletionDetailsFieldError.stateRelatedMessage}
                </p>
              )}
            </fieldset>
          )}
          {formValues.status !== "DID_NOT_SHOW" && (
            <ConventionTotalHours
              totalHours={totalHours}
              illustration={<img src={commonIllustrations.warning} alt="" />}
            />
          )}
        </div>
      </div>
      {printWeekSchedule({
        schedule: convention.schedule,
        dateEnd: convention.dateEnd,
        dateStart: convention.dateStart,
        useWrapper: true,
      })}
      <ButtonsGroup
        inlineLayoutWhen="always"
        buttons={[
          {
            children: "Revenir à l'étape précédente",
            disabled: true,
            type: "button",
            priority: "secondary",
            id: domElementIds.assessment.previousButtonForStep({
              currentStep: 1,
            }),
          },
          formValues.status === "DID_NOT_SHOW"
            ? {
                children: "Envoyer le bilan",
                type: "submit",
                priority: "primary",
                id: domElementIds.assessment.formSubmitButton,
              }
            : {
                children: "Passer à l'étape suivante",
                onClick: () =>
                  onStepChange(2, [
                    "status",
                    ...(formValues.status === "PARTIALLY_COMPLETED"
                      ? partialCompletionDetailsFields
                      : []),
                  ]),
                type: "button",
                priority: "primary",
                id: domElementIds.assessment.nextButtonFromStepAndMode({
                  currentStep: 1,
                }),
              },
        ]}
      />
    </>
  );
};

const AssessmentContractSection = ({
  onStepChange,
  convention,
}: {
  onStepChange: OnStepChange;
  convention: ConventionReadDto;
}) => {
  const { register, watch, setValue, formState } =
    useFormContext<AssessmentFormDto>();
  const endedWithAJobValue = watch("endedWithAJob");
  const getFieldError = makeFieldError(formState);
  return (
    <>
      <RadioButtons
        legend="L'immersion a-t-elle débouché sur une embauche ? *"
        id={domElementIds.assessment.endedWithAJobInput}
        options={[
          {
            label: "Oui",
            nativeInputProps: {
              name: register("endedWithAJob").name,
              onChange: () => {
                setValue("endedWithAJob", true);
              },
              checked: endedWithAJobValue === true,
            },
          },
          {
            label: "Non",
            nativeInputProps: {
              name: register("endedWithAJob").name,
              onChange: () => {
                setValue("endedWithAJob", false);
              },
              checked: endedWithAJobValue === false,
            },
          },
        ]}
        {...getFieldError("endedWithAJob")}
      />
      {endedWithAJobValue && (
        <div className={fr.cx("fr-grid-row", "fr-mb-4w")}>
          <div className={fr.cx("fr-col-lg-5")}>
            <Select
              label="Type de contrat associé à l’embauche : *"
              id={domElementIds.assessment.typeOfContractInput}
              options={typeOfContracts.map((contractType) => ({
                label: contractType,
                value: contractType,
              }))}
              nativeSelectProps={{
                ...register("typeOfContract", {
                  setValueAs: setValueAsNull,
                }),
              }}
              {...getFieldError("typeOfContract")}
            />

            <Input
              label="Date de début du contrat : *"
              nativeInputProps={{
                ...register("contractStartDate", {
                  setValueAs: setValueAsNull,
                }),
                id: domElementIds.assessment.contractStartDateInput,
                type: "date",
                min: toDateUTCString(new Date(convention.dateStart)),
              }}
              {...getFieldError("contractStartDate")}
            />
          </div>
        </div>
      )}
      <ButtonsGroup
        inlineLayoutWhen="always"
        buttons={[
          {
            children: "Revenir à l'étape précédente",
            disabled: false,
            type: "button",
            onClick: () => onStepChange(1, []),
            priority: "secondary",
            id: domElementIds.assessment.previousButtonForStep({
              currentStep: 2,
            }),
          },
          {
            children: "Passer à l'étape suivante",
            onClick: () =>
              onStepChange(
                3,
                endedWithAJobValue
                  ? ["typeOfContract", "contractStartDate", "endedWithAJob"]
                  : ["endedWithAJob"],
              ),
            type: "button",
            priority: "primary",
            id: domElementIds.assessment.nextButtonFromStepAndMode({
              currentStep: 2,
            }),
          },
        ]}
      />
    </>
  );
};

const AssessmentCommentsSection = ({
  onStepChange,
  jobTitle,
  objective,
}: {
  onStepChange: OnStepChange;
  jobTitle: string;
  objective: string;
}) => {
  const isLoading = useAppSelector(assessmentSelectors.isLoading);
  const { register, formState } = useFormContext<AssessmentFormDto>();
  const getFieldError = makeFieldError(formState);
  return (
    <div className={fr.cx("fr-grid-row")}>
      <div className={fr.cx("fr-col-lg-8")}>
        <ConventionJobAndObjective
          jobIllustration={<img src={commonIllustrations.job} alt="" />}
          objectiveIllustration={
            <img src={commonIllustrations.objective} alt="" />
          }
          jobTitle={jobTitle}
          objective={objective}
        />
        <Input
          textArea
          label="Avez-vous une appréciation générale à donner sur l'immersion ? *"
          nativeTextAreaProps={{
            ...register("establishmentFeedback"),
            id: domElementIds.assessment.establishmentAdvicesInput,
          }}
          {...getFieldError("establishmentFeedback")}
        />
        <Input
          textArea
          label="Sur la base de l'objectif de l'immersion et du métier observé, quels conseils donneriez-vous au candidat pour la suite de son parcours professionnel ? *"
          nativeTextAreaProps={{
            ...register("establishmentAdvices"),
            id: domElementIds.assessment.establishmentFeedbackInput,
          }}
          {...getFieldError("establishmentAdvices")}
        />
        <ButtonsGroup
          inlineLayoutWhen="always"
          buttons={[
            {
              children: "Revenir à l'étape précédente",
              type: "button",
              onClick: () => onStepChange(2, []),
              priority: "secondary",
              id: domElementIds.assessment.previousButtonForStep({
                currentStep: 3,
              }),
            },
            {
              children: "Envoyer le bilan",
              type: "submit",
              priority: "primary",
              id: domElementIds.assessment.formSubmitButton,
              disabled: isLoading,
            },
          ]}
        />
      </div>
    </div>
  );
};
