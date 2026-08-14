import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AgencyId,
  type RejectConnectedUserRoleForAgencyParams,
  rejectIcUserRoleForAgencyParamsSchema,
  type UserId,
} from "shared";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";

type IcUserRegistrationToAgencyFormProps = {
  agency: {
    id: AgencyId;
    name: string;
  };
  userId: UserId;
  onSubmit: () => void;
};

export const RejectIcUserRegistrationToAgencyForm = ({
  agency,
  userId,
  onSubmit,
}: IcUserRegistrationToAgencyFormProps) => {
  const dispatch = useDispatch();
  const { register, handleSubmit, formState } =
    useForm<RejectConnectedUserRoleForAgencyParams>({
      resolver: zodResolver(rejectIcUserRoleForAgencyParamsSchema),
      mode: "onTouched",
      defaultValues: {
        agencyId: agency.id,
        userId,
        justification: "",
      },
    });

  const getFieldError = makeFieldError(formState);

  const onFormSubmit: SubmitHandler<RejectConnectedUserRoleForAgencyParams> = (
    values,
  ) => {
    dispatch(
      connectedUsersAdminSlice.actions.rejectAgencyWithRoleToUserRequested(
        values,
      ),
    );
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <Input
        label={`Motif de refus de rattachement à l'agence ${agency.name}`}
        nativeInputProps={register("justification")}
        {...getFieldError("justification")}
      />
      <ButtonsGroup
        alignment="center"
        inlineLayoutWhen="always"
        buttons={[
          {
            type: "button",
            priority: "secondary",
            onClick: onSubmit,
            children: "Annuler",
          },
          {
            type: "submit",
            children: "Refuser le rattachement",
          },
        ]}
      />
    </form>
  );
};
