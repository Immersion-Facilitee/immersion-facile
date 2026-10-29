import {
  type ConventionActorRole,
  type ConventionDto,
  errors,
  type VisitorOtpJwtPayload,
} from "shared";
import { match } from "ts-pattern";
import { makeEmailHash } from "../../../../../utils/jwt";
import { useCaseBuilder } from "../../../useCaseBuilder";

type MaskedOtpRecipients = {
  email: string | null;
  phone: string | null;
};

export type GetMaskedOtpRecipients = ReturnType<
  typeof makeGetMaskedOtpRecipients
>;

export const makeGetMaskedOtpRecipients = useCaseBuilder(
  "GetMaskedOtpRecipients",
)
  .withCurrentUser<VisitorOtpJwtPayload>()
  .withOutput<MaskedOtpRecipients>()
  .build(async ({ currentUser, uow }) => {
    return match(currentUser.purpose)
      .with("manageConvention", async (): Promise<MaskedOtpRecipients> => {
        const conventionId = currentUser.subject.conventionId;

        // get la convention
        const convention = await uow.conventionRepository.getById(conventionId);

        if (!convention)
          throw errors.convention.notFound({
            conventionId: currentUser.subject.conventionId,
          });

        const isEmailHashMatchingGivenRole: boolean =
          getIsEmailHashMatchingGivenRole({
            convention,
            emailHash: currentUser.subject.emailHash,
            role: currentUser.subject.role,
          });

        if (!isEmailHashMatchingGivenRole)
          throw errors.convention.forbiddenMissingRightsEmailHash({
            conventionId: conventionId,
            role: currentUser.subject.role,
            emailHash: currentUser.subject.emailHash,
          });

        // si pas présent dans la conv erreur
        // sinon on masque et on return
        return { email: null, phone: null };
      })
      .exhaustive();
  });

const getIsEmailHashMatchingGivenRole = ({
  convention,
  emailHash,
  role,
}: {
  convention: ConventionDto;
  emailHash: string;
  role: ConventionActorRole;
}): boolean =>
  match(role)
    .with(
      "beneficiary",
      () =>
        makeEmailHash(convention.signatories.beneficiary.email) === emailHash,
    )
    .with(
      "establishment-representative",
      () =>
        makeEmailHash(
          convention.signatories.establishmentRepresentative.email,
        ) === emailHash,
    )
    .with(
      "establishment-tutor",
      () => makeEmailHash(convention.establishmentTutor.email) === emailHash,
    )
    .with("beneficiary-representative", () => {
      if (!convention.signatories.beneficiaryRepresentative?.email)
        throw errors.convention.missingActor({
          conventionId: convention.id,
          role: "beneficiary-current-employer",
        });
      return (
        makeEmailHash(
          convention.signatories.beneficiaryRepresentative.email,
        ) === emailHash
      );
    })
    .with("beneficiary-current-employer", () => {
      if (!convention.signatories.beneficiaryCurrentEmployer?.email)
        throw errors.convention.missingActor({
          conventionId: convention.id,
          role: "beneficiary-current-employer",
        });
      return (
        makeEmailHash(
          convention.signatories.beneficiaryCurrentEmployer.email,
        ) === emailHash
      );
    })
    .exhaustive();
