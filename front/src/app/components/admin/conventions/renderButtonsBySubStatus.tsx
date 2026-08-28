/** biome-ignore-all lint/complexity/useLiteralKeys: false positive */
import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { ReactElement } from "react";
import { ButtonWithSubMenu } from "react-design-system";
import { domElementIds } from "shared";
import type { ButtonConfiguration } from "src/app/components/forms/convention/manage-actions/getButtonConfigBySubStatus";
import type { ConventionSubStatus } from "src/app/utils/conventionSubStatus";
import { match, P } from "ts-pattern";
import { ModalWrapper } from "../../forms/convention/manage-actions/ManageActionModalWrapper";

export type ButtonArea = (typeof allAreas)[number];

const allAreas = [
  "otherActionArea",
  "cancelationArea",
  "editionArea",
  "validationArea",
  "assessmentArea",
  "conventionArea",
  "signatureArea",
] as const;

const getButtonWithSubMenuIdAndLabels: (
  subStatus: ConventionSubStatus,
) => Record<ButtonArea, { id?: string; label: string }> = (
  subStatus: ConventionSubStatus,
) => {
  const otherActionLabel =
    subStatus === "cancelledWithBroadcastError" ||
    subStatus === "cancelledWithoutBroadcastError" ||
    subStatus === "deprecatedWithBroadcastError" ||
    subStatus === "deprecatedWithoutBroadcastError" ||
    subStatus === "rejectedWithBroadcastError" ||
    subStatus === "rejectedWithoutBroadcastError"
      ? {
          id: domElementIds.manageConvention.otherActionsButton,
          label: "Gérer la synchronisation",
        }
      : {
          id: domElementIds.manageConvention.otherActionsButton,
          label: "Autres actions",
        };

  return {
    cancelationArea: {
      id: domElementIds.manageConvention.cancelActionButton,
      label: "Annuler la demande",
    },
    editionArea: {
      id: domElementIds.manageConvention.editActionsButton,
      label: "Modifier la convention",
    },
    validationArea: { label: "" },
    assessmentArea: {
      id: domElementIds.manageConvention.assessmentActionsButton,
      label: "Bilan de l'immersion",
    },
    conventionArea: { label: "" },
    otherActionArea: otherActionLabel,
    signatureArea: { label: "" },
  };
};

type SubStatusButtonLayoutParams = {
  subStatus: ConventionSubStatus;
  isSignVisible: boolean;
  isAssessmentSignPrimary: boolean;
};

const getPrimaryAreaBySubStatus = ({
  subStatus,
  isSignVisible,
  isAssessmentSignPrimary,
}: SubStatusButtonLayoutParams): ButtonArea =>
  match(subStatus)
    .with(
      P.union(
        "readyToSignWithBroadcastError",
        "readyToSignWithoutBroadcastError",
        "partiallySignedWithBroadcastError",
        "partiallySignedWithoutBroadcastError",
      ),
      (): ButtonArea => (isSignVisible ? "signatureArea" : "editionArea"),
    )
    .with(
      P.union(
        "inReviewWithSingleValidationWithBroadcastError",
        "inReviewWithSingleValidationWithoutBroadcastError",
        "inReviewWithDoubleValidationWithBroadcastError",
        "inReviewWithDoubleValidationWithoutBroadcastError",
        "acceptedByCounsellorWithBroadcastError",
        "acceptedByCounsellorWithoutBroadcastError",
      ),
      (): ButtonArea => "validationArea",
    )
    .with(
      P.union(
        "acceptedByValidatorWithAssessmentWithBroadcastError",
        "acceptedByValidatorWithAssessmentWithoutBroadcastError",
      ),
      (): ButtonArea =>
        isAssessmentSignPrimary ? "assessmentArea" : "conventionArea",
    )
    .with(
      P.union(
        "acceptedByValidatorWithoutAssessmentDidNotStartWithBroadcastError",
        "acceptedByValidatorWithoutAssessmentDidNotStartWithoutBroadcastError",
        "acceptedByValidatorWithoutAssessmentDidStartEndingInOneDayOrMoreWithBroadcastError",
        "acceptedByValidatorWithoutAssessmentDidStartEndingInOneDayOrMoreWithoutBroadcastError",
        "acceptedByValidatorWithoutAssessmentDidStartEndingTomorrowOrAlreadyEndedWithBroadcastError",
        "acceptedByValidatorWithoutAssessmentDidStartEndingTomorrowOrAlreadyEndedWithoutBroadcastError",
      ),
      (): ButtonArea => "conventionArea",
    )
    .with(
      P.union(
        "rejectedWithBroadcastError",
        "rejectedWithoutBroadcastError",
        "cancelledWithBroadcastError",
        "cancelledWithoutBroadcastError",
        "deprecatedWithBroadcastError",
        "deprecatedWithoutBroadcastError",
      ),
      (): ButtonArea => "otherActionArea",
    )
    .exhaustive();

type RenderButtonsBySubStatusParams = {
  buttonConfig: ButtonConfiguration[];
  subStatus: ConventionSubStatus;
  isAssessmentSignPrimary: boolean;
};

type RenderedButtons = {
  leftButtons: ReactElement[];
  rightButtons: ReactElement[];
  modals: ReactElement[];
};

const getAreasConfig = (
  buttonsConfig: ButtonConfiguration[],
): Record<ButtonArea, ButtonConfiguration[]> => {
  return allAreas.reduce(
    (acc, area) => {
      acc[area] = buttonsConfig.filter((item) => item.buttonArea === area);
      return acc;
    },
    {} as Record<ButtonArea, ButtonConfiguration[]>,
  );
};

const getRightAndLeftAreas = ({
  buttonsConfig,
  subStatus,
  isSignVisible,
  isAssessmentSignPrimary,
}: {
  buttonsConfig: ButtonConfiguration[];
} & SubStatusButtonLayoutParams): {
  leftAreas: ButtonArea[];
  rightAreas: ButtonArea[];
} => {
  const areasConfig = getAreasConfig(buttonsConfig);
  const primaryArea = getPrimaryAreaBySubStatus({
    subStatus,
    isSignVisible,
    isAssessmentSignPrimary,
  });

  const shouldShowOtherActionOnLeft =
    areasConfig["otherActionArea"].length > 0 &&
    primaryArea !== "otherActionArea";

  const leftAreas: ButtonArea[] = shouldShowOtherActionOnLeft
    ? ["otherActionArea"]
    : [];

  const rightAreasWithoutPrimary = allAreas.filter(
    (area) => area !== primaryArea && !leftAreas.includes(area),
  );

  const rightAreas: ButtonArea[] = [...rightAreasWithoutPrimary, primaryArea];

  return { leftAreas, rightAreas };
};

export const renderButtonsBySubStatus = ({
  buttonConfig,
  subStatus,
  isAssessmentSignPrimary,
}: RenderButtonsBySubStatusParams): RenderedButtons => {
  const buttonsConfig = buttonConfig.filter(
    (config) => config.isVisibleForUserRights,
  );
  const isSignVisible = buttonsConfig.some(
    (config) =>
      config.buttonArea === "signatureArea" && config.isVisibleForUserRights,
  );
  const primaryArea = getPrimaryAreaBySubStatus({
    subStatus,
    isSignVisible,
    isAssessmentSignPrimary,
  });

  const areasConfig = getAreasConfig(buttonsConfig);
  const { leftAreas, rightAreas } = getRightAndLeftAreas({
    buttonsConfig,
    subStatus,
    isSignVisible,
    isAssessmentSignPrimary,
  });

  const renderButtonsForArea = (
    buttonConfigurations: ButtonConfiguration[],
    area: ButtonArea,
    position: "top-left" | "top-right",
  ): { buttons: ReactElement[]; modals: ReactElement[] } => {
    if (buttonConfigurations.length === 0) {
      return { buttons: [], modals: [] };
    }

    const priority: ButtonProps["priority"] =
      area === primaryArea ? "primary" : "secondary";

    if (buttonConfigurations.length === 1) {
      const { props } = buttonConfigurations[0];

      const { buttonProps } = props;

      const buttonElement = (
        <Button key={buttonProps.id} {...buttonProps} priority={priority} />
      );

      const modalElement = props.modalWrapperProps ? (
        <ModalWrapper
          key={`modal-${buttonProps.id}`}
          {...props.modalWrapperProps}
        />
      ) : null;

      return {
        buttons: [buttonElement],
        modals: modalElement ? [modalElement] : [],
      };
    }

    const navItems = buttonConfigurations.map(({ props }) => props.buttonProps);

    const modals = buttonConfigurations
      .map(
        (config) =>
          config.props.modalWrapperProps && (
            <ModalWrapper
              key={`modal-${config.props.buttonProps.id}`}
              {...config.props.modalWrapperProps}
            />
          ),
      )
      .filter((modal) => modal !== null);

    const buttonWithSubMenu = (
      <ButtonWithSubMenu
        key={area}
        id={getButtonWithSubMenuIdAndLabels(subStatus)[area].id ?? undefined}
        buttonLabel={getButtonWithSubMenuIdAndLabels(subStatus)[area].label}
        buttonIconId="fr-icon-arrow-down-s-line"
        iconPosition="right"
        navItems={navItems}
        priority={priority}
        position={position}
      />
    );

    return { buttons: [buttonWithSubMenu], modals };
  };

  const leftButtonsResults = leftAreas
    .filter((area) => areasConfig[area].length > 0)
    .map((area) => renderButtonsForArea(areasConfig[area], area, "top-left"));

  const rightButtonsResults = rightAreas
    .filter((area) => areasConfig[area].length > 0)
    .map((area) => renderButtonsForArea(areasConfig[area], area, "top-left"));

  const leftButtons = leftButtonsResults.flatMap((result) => result.buttons);
  const rightButtons = rightButtonsResults.flatMap((result) => result.buttons);
  const modals = [
    ...leftButtonsResults.flatMap((result) => result.modals),
    ...rightButtonsResults.flatMap((result) => result.modals),
  ];

  return {
    leftButtons,
    rightButtons,
    modals,
  };
};
