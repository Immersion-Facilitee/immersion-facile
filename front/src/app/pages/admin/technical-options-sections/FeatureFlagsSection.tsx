import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import Select from "@codegouvfr/react-dsfr/SelectNext";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import { zodResolver } from "@hookform/resolvers/zod";
import { keys } from "ramda";
import type { ReactNode } from "react";
import { ErrorNotifications } from "react-design-system";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type FeatureFlagHighlight,
  type FeatureFlagName,
  type FeatureFlagTextImageAndRedirect,
  type FeatureFlagTextWithSeverity,
  featureFlagHighlightValueSchema,
  featureFlagTextImageAndRedirectValueSchema,
  featureFlagTextWithSeverityValueSchema,
} from "shared";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import {
  formHighlightFieldsLabels,
  formTextImageAndRedirectFieldsLabels,
  formTextWithOptionsFieldsLabels,
} from "src/app/contents/forms/admin/technicalOptions";
import {
  displayReadableError,
  getFormContents,
  toErrorsWithLabels,
} from "src/app/hooks/formContents.hooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import { featureFlagsSlice } from "src/core-logic/domain/featureFlags/featureFlags.slice";
import { match } from "ts-pattern";

export const FeatureFlagsSection = () => {
  const dispatch = useDispatch();
  const { isLoading: _, ...featureFlags } = useFeatureFlags();

  return (
    <BackofficeDashboardTabContent title="Les fonctionnalités optionnelles">
      <FeatureFlagListWrapper>
        {keys(labelsByFeatureFlag).map((featureFlagName, index) => (
          <div key={featureFlagName} className={fr.cx(index > 0 && "fr-mt-4w")}>
            {labelsByFeatureFlag[featureFlagName].title && (
              <h5>{labelsByFeatureFlag[featureFlagName].title}</h5>
            )}
            <ToggleSwitch
              label={labelsByFeatureFlag[featureFlagName].enableLabel}
              checked={featureFlags[featureFlagName].isActive}
              showCheckedHint={false}
              onChange={() => {
                const isConfirmed = window.confirm(
                  "Vous aller changer ce réglage pour tous les utilisateurs, voulez-vous confirmer ?",
                );

                if (isConfirmed)
                  dispatch(
                    featureFlagsSlice.actions.setFeatureFlagRequested({
                      flagName: featureFlagName,
                      featureFlag: {
                        ...featureFlags[featureFlagName],
                        isActive: !featureFlags[featureFlagName].isActive,
                      },
                    }),
                  );
              }}
            />
            {match(featureFlags[featureFlagName])
              .with({ kind: "textWithSeverity" }, (featureFlagText) => (
                <FeatureFlagTextWithSeverityForm
                  featureFlag={featureFlagText}
                  featureFlagName={featureFlagName}
                />
              ))
              .with(
                { kind: "textImageAndRedirect" },
                (featureFlagTextImageAndRedirect) => (
                  <FeatureFlagTextImageAndRedirectForm
                    featureFlag={featureFlagTextImageAndRedirect}
                    featureFlagName={featureFlagName}
                  />
                ),
              )
              .with({ kind: "boolean" }, () => null)
              .with({ kind: "highlight" }, (featureFlagHighlight) => (
                <FeatureFlagHighlightForm
                  featureFlag={featureFlagHighlight}
                  featureFlagName={featureFlagName}
                />
              ))
              .exhaustive()}
          </div>
        ))}
      </FeatureFlagListWrapper>
    </BackofficeDashboardTabContent>
  );
};

const FeatureFlagListWrapper = ({ children }: { children: ReactNode }) => (
  <div className={fr.cx("fr-grid-row")}>
    <div className={fr.cx("fr-col")}>
      <div className={fr.cx("fr-input-group")}>
        <fieldset className={fr.cx("fr-fieldset")}>
          <div className={fr.cx("fr-fieldset__content")}>{children}</div>
        </fieldset>
      </div>
    </div>
  </div>
);

const labelsByFeatureFlag: Record<
  FeatureFlagName,
  {
    title: string | null;
    enableLabel: string;
  }
> = {
  enableTemporaryOperation: {
    title: "Offre temporaire",
    enableLabel: "Activer l'offre temporaire",
  },
  enableMaintenance: {
    title: "Maintenance",
    enableLabel: "Activer le mode maintenance",
  },
  enableSearchByScore: {
    title: "Recherche par pertinence",
    enableLabel: "Activer la recherche par pertinence (scoring)",
  },
  enableBroadcastOfMissionLocaleToFT: {
    title: "Diffusion des conventions à France Travail",
    enableLabel: "Activer les Missions Locales",
  },
  enableBroadcastOfConseilDepartementalToFT: {
    title: null,
    enableLabel: "Activer les Conseils Départementaux",
  },
  enableBroadcastOfCapEmploiToFT: {
    title: null,
    enableLabel: "Activer les Cap-Emploi",
  },
  enableEstablishmentDashboardHighlight: {
    title: "Promotion via les tableaux de bord",
    enableLabel: "Promotion sur le tableau de bord entreprise",
  },
  enableAgencyDashboardHighlight: {
    title: null,
    enableLabel: "Promotion sur le tableau de bord prescripteur",
  },
  enableInactiveUsersCleanup: {
    title: "Suppression des comptes inactifs",
    enableLabel:
      "Activer l'alerting et la suppression des comptes inactifs (>2 ans)",
  },
  enableInactiveUsersDeletionAutoProcessing: {
    title: null,
    enableLabel:
      "Traiter automatiquement les events de suppression (sinon mis en quarantaine)",
  },
  enableRequestArchivedConvention: {
    title: "Archivage des conventions",
    enableLabel: "Activer la demande d'accès à une convention archivée",
  },
  enableBeneficiaryManageConvention: {
    title: "Pilotage convention candidat",
    enableLabel: "Activer l'accès au pilotage depuis Mes conventions",
  },
};

const FeatureFlagTextWithSeverityForm = ({
  featureFlag,
  featureFlagName,
}: {
  featureFlag: FeatureFlagTextWithSeverity;
  featureFlagName: FeatureFlagName;
}) => {
  const dispatch = useDispatch();

  const { register, handleSubmit, formState } = useForm<
    FeatureFlagTextWithSeverity["value"]
  >({
    defaultValues: featureFlag.value,
    mode: "onTouched",
    resolver: zodResolver(featureFlagTextWithSeverityValueSchema),
  });

  const { getFormErrors, getFormFields } = getFormContents(
    formTextWithOptionsFieldsLabels,
  );

  const formFields = getFormFields();

  const onFormSubmit = (value: FeatureFlagTextWithSeverity["value"]) => {
    dispatch(
      featureFlagsSlice.actions.setFeatureFlagRequested({
        flagName: featureFlagName,
        featureFlag: {
          ...featureFlag,
          value,
        },
      }),
    );
  };

  return (
    <form className={fr.cx("fr-ml-9w")} onSubmit={handleSubmit(onFormSubmit)}>
      <Input
        {...formFields.message}
        textArea
        nativeTextAreaProps={{
          ...formFields.message,
          ...register("message"),
        }}
      />
      {formFields.severity.options && (
        <Select
          {...formFields.severity}
          nativeSelectProps={{
            ...register("severity"),
          }}
          options={formFields.severity.options}
        />
      )}

      <ErrorNotifications
        errorsWithLabels={toErrorsWithLabels({
          errors: displayReadableError(formState.errors),
          labels: getFormErrors(),
        })}
        visible={
          formState.submitCount !== 0 &&
          Object.values(formState.errors).length > 0
        }
      />
      <Button size="small">Mettre à jour cette option</Button>
    </form>
  );
};

const FeatureFlagTextImageAndRedirectForm = ({
  featureFlag,
  featureFlagName,
}: {
  featureFlag: FeatureFlagTextImageAndRedirect;
  featureFlagName: FeatureFlagName;
}) => {
  const dispatch = useDispatch();

  const { register, handleSubmit, formState } = useForm<
    FeatureFlagTextImageAndRedirect["value"]
  >({
    defaultValues: featureFlag.value,
    mode: "onTouched",
    resolver: zodResolver(featureFlagTextImageAndRedirectValueSchema),
  });
  const { getFormErrors, getFormFields } = getFormContents(
    formTextImageAndRedirectFieldsLabels,
  );

  const formFields = getFormFields();

  const onFormSubmit = (value: FeatureFlagTextImageAndRedirect["value"]) => {
    dispatch(
      featureFlagsSlice.actions.setFeatureFlagRequested({
        flagName: featureFlagName,
        featureFlag: {
          ...featureFlag,
          value,
        },
      }),
    );
  };

  return (
    <form className={fr.cx("fr-ml-9w")} onSubmit={handleSubmit(onFormSubmit)}>
      <Input
        {...formFields.overtitle}
        nativeInputProps={{
          ...formFields.overtitle,
          ...register("overtitle"),
        }}
      />
      <Input
        {...formFields.title}
        nativeInputProps={{
          ...formFields.title,
          ...register("title"),
        }}
      />
      <Input
        {...formFields.message}
        label="Message (optionel)"
        nativeInputProps={{
          ...formFields.message,
          ...register("message"),
        }}
      />
      <Input
        {...formFields.imageUrl}
        nativeInputProps={{
          ...formFields.imageUrl,
          ...register("imageUrl"),
        }}
      />
      <Input
        {...formFields.imageAlt}
        nativeInputProps={{
          ...formFields.imageAlt,
          ...register("imageAlt"),
        }}
      />
      <Input
        {...formFields.redirectUrl}
        nativeInputProps={{
          ...formFields.redirectUrl,
          ...register("redirectUrl"),
        }}
      />
      <ErrorNotifications
        errorsWithLabels={toErrorsWithLabels({
          errors: displayReadableError(formState.errors),
          labels: getFormErrors(),
        })}
        visible={
          formState.submitCount !== 0 &&
          Object.values(formState.errors).length > 0
        }
      />
      <Button size="small">Mettre à jour cette option</Button>
    </form>
  );
};

const FeatureFlagHighlightForm = ({
  featureFlag,
  featureFlagName,
}: {
  featureFlag: FeatureFlagHighlight;
  featureFlagName: FeatureFlagName;
}) => {
  const dispatch = useDispatch();

  const { register, handleSubmit, formState } = useForm<
    FeatureFlagHighlight["value"]
  >({
    defaultValues: featureFlag.value,
    mode: "onTouched",
    resolver: zodResolver(featureFlagHighlightValueSchema),
  });
  const { getFormErrors, getFormFields } = getFormContents(
    formHighlightFieldsLabels,
  );

  const formFields = getFormFields();

  const onFormSubmit = (value: FeatureFlagHighlight["value"]) => {
    dispatch(
      featureFlagsSlice.actions.setFeatureFlagRequested({
        flagName: featureFlagName,
        featureFlag: {
          ...featureFlag,
          value,
        },
      }),
    );
  };
  return (
    <form className={fr.cx("fr-ml-9w")} onSubmit={handleSubmit(onFormSubmit)}>
      <Input
        {...formFields.title}
        nativeInputProps={{
          ...formFields.title,
          ...register("title"),
        }}
      />
      <Input
        {...formFields.message}
        nativeInputProps={{
          ...formFields.message,
          ...register("message"),
        }}
      />
      <Input
        {...formFields.href}
        nativeInputProps={{
          ...formFields.href,
          ...register("href"),
        }}
      />
      <Input
        {...formFields.label}
        nativeInputProps={{
          ...formFields.label,
          ...register("label"),
        }}
      />
      <ErrorNotifications
        errorsWithLabels={toErrorsWithLabels({
          errors: displayReadableError(formState.errors),
          labels: getFormErrors(),
        })}
        visible={
          formState.submitCount !== 0 &&
          Object.values(formState.errors).length > 0
        }
      />
      <Button size="small">Mettre à jour cette option</Button>
    </form>
  );
};
