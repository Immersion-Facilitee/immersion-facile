import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";

import { useFormContext } from "react-hook-form";
import {
  type ConventionReadDto,
  conventionObjectiveOptions,
  isRemotableWorkMode,
} from "shared";
import { ConventionFormProfession } from "src/app/components/forms/convention/ConventionFormProfession";
import { booleanSelectOptions } from "src/app/contents/forms/common/values";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";

export const ImmersionDetailsSection = ({
  isConventionTemplate,
}: {
  isConventionTemplate: boolean;
}): JSX.Element => {
  const { setValue, getValues, register, watch, formState } =
    useFormContext<ConventionReadDto>();
  const values = getValues();
  const getFieldError = makeFieldError(formState);

  const hasIndividualProtection = watch("individualProtection");
  const hasSanitaryPrevention = watch("sanitaryPrevention");

  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: values.internshipKind,
      isConventionTemplate,
    }),
  );
  const formContents = getFormFields();

  return (
    <>
      <RadioButtons
        {...formContents.individualProtection}
        legend={formContents.individualProtection.label}
        hintText={formContents.individualProtection.hintText}
        options={booleanSelectOptions.map((option) => ({
          ...option,
          nativeInputProps: {
            ...option.nativeInputProps,
            checked:
              Boolean(option.nativeInputProps.value) ===
              values.individualProtection,
            onChange: () => {
              if (option.nativeInputProps.value === 0) {
                setValue("individualProtectionDescription", "");
              }
              setValue(
                "individualProtection",
                option.nativeInputProps.value === 1,
              );
            },
          },
        }))}
        {...getFieldError("individualProtection")}
      />

      {hasIndividualProtection && (
        <Input
          label={formContents.individualProtectionDescription.label}
          hintText={formContents.individualProtectionDescription.hintText}
          nativeInputProps={{
            ...formContents.individualProtectionDescription,
            ...register("individualProtectionDescription"),
          }}
          {...getFieldError("individualProtectionDescription")}
        />
      )}

      {values.internshipKind === "mini-stage-cci" && (
        <Alert
          small
          severity="info"
          className={fr.cx("fr-mb-4w")}
          description="En application des articles L 4153-8 et D 4153-15 et suivants du code
        du travail, relatif aux travaux interdits et règlementés, le jeune,
        s’il est mineur, ne peut accéder aux machines, appareils ou produits
        dont l’usage est proscrit aux mineurs. Il ne peut ni procéder à des
        manœuvres ou manipulations sur d’autres machines, produits ou
        appareils de production, ni effectuer les travaux légers autorisés aux
        mineurs par le même code."
        />
      )}

      <RadioButtons
        {...formContents.sanitaryPrevention}
        legend={formContents.sanitaryPrevention.label}
        hintText={formContents.sanitaryPrevention.hintText}
        options={booleanSelectOptions.map((option) => ({
          ...option,
          nativeInputProps: {
            ...option.nativeInputProps,
            checked:
              Boolean(option.nativeInputProps.value) ===
              values.sanitaryPrevention,
            onChange: () => {
              if (option.nativeInputProps.value === 0) {
                setValue("sanitaryPreventionDescription", "");
              }
              setValue(
                "sanitaryPrevention",
                option.nativeInputProps.value === 1,
                {
                  shouldValidate: true,
                },
              );
            },
          },
        }))}
        {...getFieldError("sanitaryPrevention")}
      />

      {hasSanitaryPrevention && (
        <Input
          label={formContents.sanitaryPreventionDescription.label}
          hintText={formContents.sanitaryPreventionDescription.hintText}
          nativeInputProps={{
            ...formContents.sanitaryPreventionDescription,
            ...register("sanitaryPreventionDescription"),
          }}
          {...getFieldError("sanitaryPreventionDescription")}
        />
      )}
      {values.internshipKind === "mini-stage-cci" && (
        <Alert
          small
          severity="info"
          className={fr.cx("fr-mb-4w")}
          description="De même, les parties signataires de la convention s’engagent à mettre
        en œuvre et respecter les consignes publiées par les services de
        l’Etat, notamment pour exemple celles concernant les mesures de
        prévention des risques de contamination en matière sanitaire."
        />
      )}

      <RadioButtons
        {...formContents.immersionObjective}
        legend={formContents.immersionObjective.label}
        hintText={formContents.immersionObjective.hintText}
        options={conventionObjectiveOptions
          .filter((option) =>
            values.internshipKind !== "mini-stage-cci"
              ? true
              : option !== "Initier une démarche de recrutement",
          )
          .map((option) => ({
            value: option,
            label: option,
            nativeInputProps: {
              onChange: () => setValue("immersionObjective", option),
              checked: option === values.immersionObjective,
              value: option,
            },
          }))}
        {...getFieldError("immersionObjective")}
      />

      <ConventionFormProfession {...formContents.immersionAppellation} />
      <Input
        label={formContents.workConditions.label}
        hintText={formContents.workConditions.hintText}
        textArea
        nativeTextAreaProps={{
          ...formContents.workConditions,
          ...register("workConditions"),
        }}
        {...(getFieldError("workConditions") ??
          (isRemotableWorkMode(values.remoteWorkMode)
            ? {
                state: "info",
                stateRelatedMessage: `Vous avez indiqué du télétravail pour cette immersion, indiquez ici le lieu de télétravail (ex. domicile, espace de coworking...). Cela fait partie des conditions réelles du poste et doit être précisé pour sécuriser le cadre de l'immersion.`,
              }
            : undefined))}
      />

      {values.internshipKind === "mini-stage-cci" && (
        <Alert
          small
          severity="info"
          className={fr.cx("fr-mb-4w")}
          title="Déplacements"
          description="Les déplacements dans le cadre du stage ne sont pas interdits tant qu’ils se font en présence et sous la responsabilité du tuteur et pendant les horaires prévus à la convention."
        />
      )}
      <Input
        label={formContents.businessAdvantages.label}
        hintText={formContents.businessAdvantages.hintText}
        textArea
        nativeTextAreaProps={{
          ...formContents.businessAdvantages,
          ...register("businessAdvantages"),
        }}
        {...getFieldError("businessAdvantages")}
      />
      <Input
        label={formContents.immersionActivities.label}
        hintText={formContents.immersionActivities.hintText}
        textArea
        nativeTextAreaProps={{
          ...formContents.immersionActivities,
          ...register("immersionActivities"),
        }}
        {...getFieldError("immersionActivities")}
      />
      {values.internshipKind === "mini-stage-cci" && (
        <Alert
          small
          severity="info"
          className={fr.cx("fr-mb-4w")}
          description="Durant la période d’observation, le jeune participe à des activités de
        l’entreprise, en liaison avec les objectifs précisés dans les dispositions relatives aux conditions de réalisation du mini-stage de découverte, sous le contrôle des personnels responsables de leur
        encadrement en milieu professionnel. Il est soumis aux règles
        générales en vigueur dans l’entreprise ou l’organisme d’accueil,
        notamment en matière de santé, sécurité, d’horaires et de discipline.
        Le jeune est tenu au respect du secret professionnel."
        />
      )}
      <Input
        label={formContents.immersionSkills.label}
        hintText={formContents.immersionSkills.hintText}
        nativeInputProps={{
          ...formContents.immersionSkills,
          ...register("immersionSkills"),
        }}
        {...getFieldError("immersionSkills")}
      />
    </>
  );
};
