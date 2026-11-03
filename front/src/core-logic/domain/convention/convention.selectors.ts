import { createSelector } from "@reduxjs/toolkit";
import {
  type ConventionDto,
  type ConventionField,
  getConventionFieldName,
  isStillSignatoryOnUpdatedConvention,
  type Signatory,
  type SignatoryRole,
} from "shared";
import type { RootState } from "src/core-logic/storeConfig/store";

const conventionState = (state: RootState) => state.convention;

const convention = createSelector(
  conventionState,
  ({ convention }) => convention,
);

const initialFetchedConvention = createSelector(
  conventionState,
  ({ initialFetchedConvention }) => initialFetchedConvention,
);

const isLoading = createSelector(conventionState, ({ isLoading }) => isLoading);

const similarConventionIds = createSelector(
  conventionState,
  ({ similarConventionIds }) => similarConventionIds,
);

const isMinor = createSelector(conventionState, ({ formUi }) => formUi.isMinor);

const showSummary = createSelector(
  conventionState,
  ({ formUi }) => formUi.showSummary,
);

const agencyDepartment = createSelector(
  conventionState,
  ({ formUi }) => formUi.agencyDepartment,
);

const hasCurrentEmployer = createSelector(
  conventionState,
  ({ formUi }) => formUi.hasCurrentEmployer,
);
const isTutorEstablishmentRepresentative = createSelector(
  conventionState,
  ({ formUi }) => formUi.isTutorEstablishmentRepresentative,
);

type SignatoryData = {
  signatory: Signatory | null;
  signedAtFieldName: ConventionField | null;
};

const signatoryData = createSelector(
  conventionState,
  ({
    convention,
    initialFetchedConvention,
    currentSignatoryRole,
  }): SignatoryData => {
    if (
      !convention ||
      !currentSignatoryRole ||
      (initialFetchedConvention &&
        !isStillSignatoryOnUpdatedConvention({
          signatoryRole: currentSignatoryRole,
          initialConvention: initialFetchedConvention,
          updatedConvention: convention,
        }))
    )
      return { signatory: null, signedAtFieldName: null };
    return signatoryDataFromConvention(convention, currentSignatoryRole);
  },
);

const conventionStatusDashboardUrl = createSelector(
  conventionState,
  ({ conventionStatusDashboardUrl }) => conventionStatusDashboardUrl,
);

const currentStep = createSelector(
  conventionState,
  ({ formUi }) => formUi.currentStep,
);

export const conventionSelectors = {
  convention,
  initialFetchedConvention,
  signatoryData,
  isLoading,
  isMinor,
  isTutorEstablishmentRepresentative,
  hasCurrentEmployer,
  conventionStatusDashboardUrl,
  currentStep,
  showSummary,
  agencyDepartment,
  similarConventionIds,
};

export const signatoryDataFromConvention = (
  convention: ConventionDto,
  signatoryRole: SignatoryRole,
): SignatoryData => {
  const establishmentRepresentative: SignatoryData = {
    signatory: convention.signatories.establishmentRepresentative,
    signedAtFieldName: getConventionFieldName(
      "signatories.establishmentRepresentative.signedAt",
    ),
  };

  const beneficiary: SignatoryData = {
    signatory: convention.signatories.beneficiary,
    signedAtFieldName: getConventionFieldName(
      "signatories.beneficiary.signedAt",
    ),
  };

  const getBeneficiaryCurrentEmployer = (): SignatoryData =>
    convention.signatories.beneficiaryCurrentEmployer
      ? {
          signatory: convention.signatories.beneficiaryCurrentEmployer,
          signedAtFieldName: getConventionFieldName(
            "signatories.beneficiaryCurrentEmployer.signedAt",
          ),
        }
      : { signatory: null, signedAtFieldName: null };

  const getBeneficiaryRepresentative = (): SignatoryData =>
    convention.signatories.beneficiaryRepresentative
      ? {
          signatory: convention.signatories.beneficiaryRepresentative,
          signedAtFieldName: getConventionFieldName(
            "signatories.beneficiaryRepresentative.signedAt",
          ),
        }
      : { signatory: null, signedAtFieldName: null };

  const dataByRole: Record<
    SignatoryRole,
    {
      signatory: Signatory | null;
      signedAtFieldName: ConventionField | null;
    }
  > = {
    beneficiary,
    "beneficiary-current-employer": getBeneficiaryCurrentEmployer(),
    "beneficiary-representative": getBeneficiaryRepresentative(),
    "establishment-representative": establishmentRepresentative,
  };

  return dataByRole[signatoryRole];
};
