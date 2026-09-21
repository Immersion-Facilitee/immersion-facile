import Input from "@codegouvfr/react-dsfr/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback } from "react";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type ConventionDto,
  type DepartmentCode,
  makeListAgencyOptionsKindFilter,
  type TransferConventionToAgencyRequestDto,
  transferConventionToAgencyRequestSchema,
} from "shared";
import {
  AgencySelector,
  departmentOptions,
} from "src/app/components/forms/commons/AgencySelector";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFormModal } from "src/app/utils/createFormModal";
import { agenciesSelectors } from "src/core-logic/domain/agencies/agencies.selectors";
import { agenciesSlice } from "src/core-logic/domain/agencies/agencies.slice";

export const TransferModalContent = ({
  onSubmit,
  closeModal,
  convention,
}: {
  onSubmit: (params: TransferConventionToAgencyRequestDto) => void;
  closeModal: () => void;
  convention: ConventionDto;
}) => {
  const dispatch = useDispatch();
  const agencyOptions = useAppSelector(agenciesSelectors.options);
  const isAgenciesLoading = useAppSelector(agenciesSelectors.isLoading);
  const agenciesFeedback = useAppSelector(agenciesSelectors.feedback);
  const methods = useForm<TransferConventionToAgencyRequestDto>({
    resolver: zodResolver(transferConventionToAgencyRequestSchema),
    mode: "onTouched",
    defaultValues: {
      agencyId: "",
      conventionId: convention.id,
      justification: "",
    },
  });
  const { register, handleSubmit, formState } = methods;
  const onFormSubmit: SubmitHandler<TransferConventionToAgencyRequestDto> = ({
    agencyId,
    conventionId,
    justification,
  }) => {
    onSubmit({ agencyId, conventionId, justification });
    closeModal();
  };

  const getFieldError = makeFieldError(formState);

  const onDepartmentCodeChangedMemoized = useCallback(
    (departmentCode: DepartmentCode) =>
      dispatch(
        agenciesSlice.actions.fetchAgencyOptionsRequested({
          filterKind: makeListAgencyOptionsKindFilter({
            convention,
            shouldListAll: true,
          }),
          departmentCode,
        }),
      ),
    [dispatch, convention.internshipKind],
  );

  const filteredAgencyOptions = agencyOptions.filter(
    (agency) => agency.id !== convention.agencyId,
  );
  const { formId } = useFormModal();
  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onFormSubmit)} id={formId}>
        <AgencySelector
          fields={{
            agencyDepartmentField: {
              name: "agencyDepartment",
              label: "Département",
              required: true,
              id: "agencyDepartment",
              placeholder: "Sélectionnez un département",
            },
            agencyIdField: {
              id: "agencyId",
              label: "Organisme",
              name: "agencyId",
              required: true,
              placeholder: "Sélectionnez un organisme",
            },
            agencyKindField: {
              name: "agencyKind",
              label: "Type d'organisme",
              required: true,
              id: "agencyKind",
              placeholder: "Veuillez choisir un type d'organisme",
            },
          }}
          shouldFilterDelegationPrescriptionAgencyKind={false}
          shouldShowAgencyKindField={convention.internshipKind === "immersion"}
          agencyDepartmentOptions={departmentOptions}
          onDepartmentCodeChangedMemoized={onDepartmentCodeChangedMemoized}
          agencyOptions={filteredAgencyOptions}
          isLoading={isAgenciesLoading}
          isFetchAgencyOptionsError={agenciesFeedback.kind === "errored"}
        />
        <Input
          textArea
          label="Justification"
          nativeTextAreaProps={{
            ...register("justification"),
          }}
          {...getFieldError("justification")}
        />
      </form>
    </FormProvider>
  );
};
