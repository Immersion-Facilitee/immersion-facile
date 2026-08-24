import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useMemo, useState } from "react";
import {
  ErrorNotifications,
  HeadingSection,
  SectionHighlight,
} from "react-design-system";
import { createPortal } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import {
  type AgencyDtoForAgencyUsersAndAdmins,
  type AgencyId,
  agencyIdSchema,
  type ConventionTemplateId,
  conventionTemplateIdSchema,
  domElementIds,
  frontRoutes,
  miniStageAgencyKinds,
  toDisplayedDate,
} from "shared";
import { AgencyTasks } from "src/app/components/agency/agency-dashboard/AgencyTasks";
import { ConventionList } from "src/app/components/agency/agency-dashboard/ConventionList";
import { ConventionTemplatesList } from "src/app/components/agency/agency-dashboard/ConventionTemplatesList";
import {
  displayReadableError,
  toErrorsWithLabels,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { commonIllustrations } from "src/assets/img/illustrations";
import { conventionTemplateSelectors } from "src/core-logic/domain/convention-template/conventionTemplate.selectors";
import { match, P } from "ts-pattern";
import { z } from "zod";

type InitiateConventionFormValues =
  | {
      initiateConventionSource: "structure";
      selectedAgencyId: AgencyId;
    }
  | {
      initiateConventionSource: "template";
      selectedConventionTemplateId: ConventionTemplateId;
    };

const defaultFormValues: InitiateConventionFormValues = {
  initiateConventionSource: "structure",
  selectedAgencyId: "",
};

const initiateConventionFormErrorLabels: Record<string, string> = {
  selectedAgencyId: "Aucun organisme sélectionné",
  selectedConventionTemplateId: "Aucun modèle sélectionné",
};

const structureFormSchema = z.object({
  initiateConventionSource: z.literal("structure"),
  selectedAgencyId: agencyIdSchema,
});

const templateFormSchema = z.object({
  initiateConventionSource: z.literal("template"),
  selectedConventionTemplateId: conventionTemplateIdSchema,
});

const initiateConventionFormSchema = z.discriminatedUnion(
  "initiateConventionSource",
  [structureFormSchema, templateFormSchema],
);

const selectAgencyToInitiateConventionModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.agencyDashboard.initiateConvention.modal,
});

export const AgencyConventionTabContent = ({
  activeAgencies,
}: {
  activeAgencies: AgencyDtoForAgencyUsersAndAdmins[];
}) => {
  const conventionTemplates = useAppSelector(
    conventionTemplateSelectors.conventionTemplates,
  );
  const [agencyTaskListElement, setAgencyTaskListElement] =
    useState<ReactNode | null>(null);

  const initiateConventionMethods = useForm<InitiateConventionFormValues>({
    defaultValues: defaultFormValues,
    resolver: zodResolver(initiateConventionFormSchema),
    mode: "onTouched",
  });

  const { watch, setValue, handleSubmit, formState, reset } =
    initiateConventionMethods;
  const { errors: formErrors, submitCount } = formState;
  const initiateConventionSource = watch("initiateConventionSource");
  const selectedAgencyId = watch("selectedAgencyId");
  const selectedConventionTemplateId = watch("selectedConventionTemplateId");

  const initiateConventionSourceOptions: RadioButtonsProps["options"] = useMemo(
    () => [
      {
        label: "À partir de vos informations",
        nativeInputProps: {
          name: "initiateConventionSource",
          value: "structure",
          checked: initiateConventionSource === "structure",
          onChange: () => {
            setValue("initiateConventionSource", "structure");
            if (activeAgencies.length === 1) {
              setValue("selectedAgencyId", activeAgencies[0].id);
            }
          },
        },
      },
      {
        label: "À partir d'un modèle",
        nativeInputProps: {
          name: "initiateConventionSource",
          value: "template",
          checked: initiateConventionSource === "template",
          onChange: () => setValue("initiateConventionSource", "template"),
          disabled: conventionTemplates.length === 0,
        },
      },
    ],
    [
      initiateConventionSource,
      activeAgencies,
      setValue,
      conventionTemplates.length,
    ],
  );

  const conventionTemplateOptions: RadioButtonsProps["options"] = useMemo(
    () =>
      conventionTemplates.map((template) => ({
        label: template.name,
        hintText: `Mise à jour le ${template.updatedAt ? toDisplayedDate({ date: new Date(template.updatedAt), withHours: true }) : ""}`,
        nativeInputProps: {
          name: "initiateConventionTemplate",
          value: template.id,
          checked: selectedConventionTemplateId === template.id,
          onChange: () => setValue("selectedConventionTemplateId", template.id),
        },
      })),
    [conventionTemplates, selectedConventionTemplateId, setValue],
  );

  const redirectToConventionPage = (
    agency: AgencyDtoForAgencyUsersAndAdmins,
  ) => {
    const internshipKind = miniStageAgencyKinds.includes(agency.kind)
      ? "mini-stage-cci"
      : "immersion";

    internshipKind === "immersion"
      ? frontRoutes
          .conventionImmersion({
            skipIntro: true,
            agencyDepartment: agency.address.departmentCode,
            agencyKind: agency.kind,
            agencyId: agency.id,
          })
          .push()
      : frontRoutes
          .conventionMiniStage({
            agencyDepartment: agency.address.departmentCode,
            agencyKind: agency.kind,
            agencyId: agency.id,
          })
          .push();
  };

  const onInitiateConventionButtonClick = () => {
    reset(defaultFormValues);
    selectAgencyToInitiateConventionModal.open();
    if (activeAgencies.length === 1) {
      setValue("selectedAgencyId", activeAgencies[0].id);
      if (conventionTemplates.length === 0) {
        onInitiateConventionFormSubmit();
      }
    }
  };

  const onInitiateConventionFormSubmit = () => {
    if (initiateConventionSource === "structure") {
      const agencyToRedirect =
        activeAgencies.length === 1
          ? activeAgencies[0]
          : selectedAgencyId
            ? activeAgencies.find((agency) => agency.id === selectedAgencyId)
            : undefined;
      if (agencyToRedirect) {
        selectAgencyToInitiateConventionModal.close();
        redirectToConventionPage(agencyToRedirect);
      }
    }
    const selectedConventionTemplate = conventionTemplates.find(
      (template) => template.id === selectedConventionTemplateId,
    );
    if (selectedConventionTemplate) {
      selectAgencyToInitiateConventionModal.close();
      frontRoutes
        .conventionImmersion({
          conventionTemplateId: selectedConventionTemplate.id,
          skipIntro: true,
          at_campaign: "agency-dashboard-convention-template",
        })
        .push();
    }
  };

  if (agencyTaskListElement) {
    return (
      <>
        <Button
          priority="secondary"
          iconId="fr-icon-arrow-left-line"
          className={fr.cx("fr-mb-3w")}
          onClick={() => {
            setAgencyTaskListElement(null);
          }}
        >
          Retour
        </Button>
        {agencyTaskListElement}
      </>
    );
  }

  return (
    <HeadingSection
      titleAs="h2"
      title="Tableau de bord"
      className={fr.cx("fr-mt-0")}
      titleAction={
        <Button
          id={domElementIds.agencyDashboard.initiateConvention.button}
          priority="primary"
          iconId="fr-icon-add-line"
          onClick={onInitiateConventionButtonClick}
        >
          Initier une convention
        </Button>
      }
    >
      <AgencyTasks
        titleAs="h3"
        onSeeAllConventionsClick={(element) => {
          setAgencyTaskListElement(element);
        }}
      />
      <ConventionList />

      <ConventionTemplatesList fromRoute={frontRoutes.agencyDashboard()} />

      {createPortal(
        <FormProvider {...initiateConventionMethods}>
          <selectAgencyToInitiateConventionModal.Component
            title="Initier une convention"
            buttons={[
              {
                doClosesModal: true,
                children: "Fermer",
              },
              {
                id: domElementIds.agencyDashboard.initiateConvention
                  .modalButton,
                children: "Initier la convention",
                doClosesModal: false,
                onClick: handleSubmit(onInitiateConventionFormSubmit),
              },
            ]}
          >
            <ErrorNotifications
              errorsWithLabels={toErrorsWithLabels({
                labels: initiateConventionFormErrorLabels,
                errors: displayReadableError(formErrors),
              })}
              visible={submitCount !== 0 && Object.keys(formErrors).length > 0}
            />
            {conventionTemplates.length > 0 && (
              <RadioButtons
                id={
                  domElementIds.agencyDashboard.initiateConvention
                    .sourceRadioButtons
                }
                name="initiateConventionSource"
                legend="Comment souhaitez-vous initier la convention ?"
                options={initiateConventionSourceOptions}
                className={fr.cx("fr-mb-3w")}
              />
            )}
            <SectionHighlight>
              {match({ initiateConventionSource, activeAgencies })
                .with(
                  {
                    initiateConventionSource: "structure",
                    activeAgencies: P.when((arr) => arr.length < 1),
                  },
                  () => null,
                )
                .with(
                  {
                    initiateConventionSource: "structure",
                    activeAgencies: P.when((arr) => arr.length === 1),
                  },
                  () => (
                    <div className={fr.cx("fr-grid-row")}>
                      <div
                        className={fr.cx(
                          "fr-hidden",
                          "fr-unhidden-md",
                          "fr-col-12",
                          "fr-col-md-3",
                          "fr-pr-2w",
                        )}
                      >
                        <img src={commonIllustrations.fillForm} alt="" />
                      </div>
                      <div className={fr.cx("fr-col-12", "fr-col-md-9")}>
                        Les informations de la convention seront pré-remplies
                        avec les informations de l'organisme sélectionné.
                      </div>
                    </div>
                  ),
                )
                .with(
                  {
                    initiateConventionSource: "structure",
                    activeAgencies: P.when((arr) => arr.length > 1),
                  },
                  () => (
                    <>
                      Choisissez l'organisme dont les informations seront
                      automatiquement pré-remplies.
                      <Select
                        label={"Organisme"}
                        className={fr.cx("fr-mt-2w")}
                        options={[
                          ...activeAgencies.map((agency) => ({
                            value: agency.id,
                            label: `${agency.name}`,
                          })),
                        ]}
                        placeholder="Mes organismes"
                        nativeSelectProps={{
                          defaultValue: "",
                          value: selectedAgencyId,
                          onChange: (event) => {
                            setValue(
                              "selectedAgencyId",
                              event.currentTarget.value,
                            );
                          },
                        }}
                      />
                    </>
                  ),
                )
                .with({ initiateConventionSource: "template" }, () => (
                  <RadioButtons
                    id={
                      domElementIds.agencyDashboard.initiateConvention
                        .templateRadioButtons
                    }
                    name="initiateConventionTemplate"
                    legend="Quel modèle souhaitez-vous utiliser ?"
                    options={conventionTemplateOptions}
                    className={fr.cx("fr-mb-3w")}
                  />
                ))
                .otherwise(() => null)}
            </SectionHighlight>
          </selectAgencyToInitiateConventionModal.Component>
        </FormProvider>,
        document.body,
      )}
    </HeadingSection>
  );
};
