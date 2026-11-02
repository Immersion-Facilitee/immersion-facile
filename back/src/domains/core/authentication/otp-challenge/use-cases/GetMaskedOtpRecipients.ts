import { parsePhoneNumberWithError } from "libphonenumber-js";
import {
  type ConventionActorRole,
  type ConventionDto,
  type Email,
  errors,
  isValidMobilePhone,
  type MaskedOtpRecipients,
  type PhoneNumber,
  type VisitorOtpJwtPayload,
} from "shared";
import { match } from "ts-pattern";
import { makeEmailHash } from "../../../../../utils/jwt";
import { useCaseBuilder } from "../../../useCaseBuilder";

type OtpRecipients = {
  email: Email;
  phone: PhoneNumber;
};

export type GetMaskedOtpRecipients = ReturnType<
  typeof makeGetMaskedOtpRecipients
>;

export const makeGetMaskedOtpRecipients = useCaseBuilder(
  "GetMaskedOtpRecipients",
)
  .withCurrentUser<VisitorOtpJwtPayload>()
  .withOutput<MaskedOtpRecipients>()
  .build(async ({ currentUser, uow }) =>
    match(currentUser.purpose)
      .with("manageConvention", async (): Promise<MaskedOtpRecipients> => {
        const { conventionId, emailHash, role } = currentUser.subject;

        const convention = await uow.conventionRepository.getById(conventionId);

        if (!convention) throw errors.convention.notFound({ conventionId });

        const recipients = getConventionActorRecipients({ convention, role });

        if (makeEmailHash(recipients.email) !== emailHash)
          throw errors.convention.forbiddenMissingRightsEmailHash({
            conventionId,
            role,
            emailHash,
          });

        return {
          email: maskEmail(recipients.email),
          phone: isValidMobilePhone(recipients.phone)
            ? maskPhone(recipients.phone)
            : null,
        };
      })
      .exhaustive(),
  );

const getConventionActorRecipients = ({
  convention,
  role,
}: {
  convention: ConventionDto;
  role: ConventionActorRole;
}): OtpRecipients =>
  match(role)
    .with("beneficiary", () => convention.signatories.beneficiary)
    .with(
      "establishment-representative",
      () => convention.signatories.establishmentRepresentative,
    )
    .with("establishment-tutor", () => convention.establishmentTutor)
    .with("beneficiary-representative", () => {
      if (!convention.signatories.beneficiaryRepresentative)
        throw errors.convention.missingActor({
          conventionId: convention.id,
          role,
        });
      return convention.signatories.beneficiaryRepresentative;
    })
    .with("beneficiary-current-employer", () => {
      if (!convention.signatories.beneficiaryCurrentEmployer)
        throw errors.convention.missingActor({
          conventionId: convention.id,
          role,
        });
      return convention.signatories.beneficiaryCurrentEmployer;
    })
    .exhaustive();

const maskEmail = (email: Email): string => {
  const [localPart, domain] = email.split("@");
  return `${localPart.charAt(0)}${"*".repeat(localPart.length - 1)}@${domain}`;
};

const maskPhone = (phone: PhoneNumber): string => {
  const nationalDigits = parsePhoneNumberWithError(phone)
    .formatNational()
    .replace(/\D/g, "");
  const visibleDigitsCount = 2;
  return `${nationalDigits.slice(0, visibleDigitsCount)}${"*".repeat(nationalDigits.length - 2 * visibleDigitsCount)}${nationalDigits.slice(-visibleDigitsCount)}`;
};
