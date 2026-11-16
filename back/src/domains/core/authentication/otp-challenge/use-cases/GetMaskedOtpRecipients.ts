import { parsePhoneNumberWithError } from "libphonenumber-js";
import {
  type Email,
  errors,
  isValidMobilePhone,
  type MaskedOtpRecipients,
  type PhoneNumber,
  type VisitorOtpJwtPayload,
} from "shared";
import { match } from "ts-pattern";
import { getConventionActorMatchingEmailHashOrThrow } from "../../../../../utils/emailHash";
import { useCaseBuilder } from "../../../useCaseBuilder";

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

        const actor = getConventionActorMatchingEmailHashOrThrow({
          convention,
          emailHash,
          role,
        });

        return {
          maskedEmail: maskEmail(actor.email),
          maskedPhone: isValidMobilePhone(actor.phone)
            ? maskPhone(actor.phone)
            : null,
        };
      })
      .exhaustive(),
  );

const maskEmail = (email: Email): string => {
  const [localPart, domain] = email.split("@");
  return `${maskEmailLocalPart(localPart)}@${domain}`;
};

const maskEmailLocalPart = (localPart: string): string => {
  if (localPart.length === 1) return "*";
  if (localPart.length === 2) return `${localPart.charAt(0)}*`;
  return `${localPart.charAt(0)}${"*".repeat(localPart.length - 2)}${localPart.charAt(localPart.length - 1)}`;
};

const maskPhone = (phone: PhoneNumber): string => {
  const nationalDigits = parsePhoneNumberWithError(phone)
    .formatNational()
    .replace(/\D/g, "");
  const visibleDigitsCount = 2;
  return `${nationalDigits.slice(0, visibleDigitsCount)}${"*".repeat(nationalDigits.length - 2 * visibleDigitsCount)}${nationalDigits.slice(-visibleDigitsCount)}`;
};
