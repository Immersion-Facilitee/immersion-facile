import { ascend, prop, sort } from "ramda";
import {
  addressDtoToString,
  type ContactEstablishmentEventPayload,
  contactEstablishmentEventPayloadSchema,
  createOpaqueEmail,
  type DiscussionDto,
  discussionEmailSender,
  type Email,
  errors,
  getFormattedFirstnameAndLastname,
  immersionFacileNoReplyEmailSender,
  type TemplatedEmail,
  type UserWithAdminRights,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import type {
  EstablishmentAggregate,
  EstablishmentUserRight,
} from "../../entities/EstablishmentAggregate";
import { getNotifiedUsersFromEstablishmentUserRights } from "../../helpers/businessContact.helpers";
import { makeContactByEmailRequestParams } from "../../helpers/contactRequest";

export type NotifyContactRequest = ReturnType<typeof makeNotifyContactRequest>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  domain: string;
  immersionFacileBaseUrl: AppConfig["immersionFacileBaseUrl"];
};

export const makeNotifyContactRequest = useCaseBuilder("NotifyContactRequest")
  .withInput<ContactEstablishmentEventPayload>(
    contactEstablishmentEventPayloadSchema,
  )
  .withDeps<Deps>()
  .build(async ({ uow, inputParams, deps }) => {
    const discussion = await uow.discussionRepository.getById(
      inputParams.discussionId,
    );

    if (!discussion)
      throw errors.discussion.notFound({
        discussionId: inputParams.discussionId,
      });

    const establishment =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        discussion.siret,
      );

    if (!establishment)
      throw errors.establishment.notFound({ siret: discussion.siret });

    return discussion.contactMode === "EMAIL"
      ? notifyOnEmailContactMode({
          uow,
          discussion,
          establishment,
          isLegacy: inputParams.isLegacy,
          deps,
        })
      : notifyOnOtherContactMode({ uow, discussion, establishment, deps });
  });

const notifyOnOtherContactMode = async ({
  uow,
  discussion,
  establishment,
  deps,
}: {
  uow: UnitOfWork;
  discussion: DiscussionDto;
  establishment: EstablishmentAggregate;
  deps: Deps;
}) => {
  const establishmentUserRightToContact = establishment.userRights.find(
    (right) =>
      (discussion.contactMode === "PHONE" && right.isMainContactByPhone) ||
      (discussion.contactMode === "IN_PERSON" && right.isMainContactInPerson),
  );
  if (!establishmentUserRightToContact)
    throw errors.establishment.contactUserNotFound({
      siret: establishment.establishment.siret,
    });

  const establishmentUserToContact = await uow.userRepository.getById(
    establishmentUserRightToContact.userId,
  );
  if (!establishmentUserToContact)
    throw errors.user.notFound({
      userId: establishmentUserRightToContact.userId,
    });

  await deps.saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent: {
      sender: immersionFacileNoReplyEmailSender,
      recipients: [discussion.potentialBeneficiary.email],
      ...getOtherContactModeParams({
        discussion,
        establishmentUserToContact,
        establishmentUserRightToContact,
      }),
    },
    followedIds: { establishmentSiret: discussion.siret },
  });
};

const notifyOnEmailContactMode = async ({
  uow,
  deps,
  discussion,
  establishment,
  isLegacy,
}: {
  uow: UnitOfWork;
  deps: Deps;
  discussion: DiscussionDto;
  establishment: EstablishmentAggregate;
  isLegacy: boolean | undefined;
}): Promise<void> => {
  const appellations =
    await uow.romeRepository.getAppellationAndRomeDtosFromAppellationCodesIfExist(
      [discussion.appellationCode],
    );
  const appellation = appellations.at(0);
  if (!appellation)
    throw errors.rome.missingAppellation({
      appellationCode: discussion.appellationCode,
    });

  const opaqueEmail: Email = createOpaqueEmail({
    discussionId: discussion.id,
    recipient: {
      kind: "potentialBeneficiary",
      firstname: discussion.potentialBeneficiary.firstName,
      lastname: discussion.potentialBeneficiary.lastName,
    },
    replyDomain: `reply.${deps.domain}`,
  });

  const notifiedRecipients = (
    await getNotifiedUsersFromEstablishmentUserRights(
      uow,
      establishment.userRights,
    )
  ).map((user) => user.email);

  const commonTemplatedContent = {
    sender: discussionEmailSender,
    recipients: notifiedRecipients,
    replyTo: {
      email: opaqueEmail,
      name: `${getFormattedFirstnameAndLastname({ firstname: discussion.potentialBeneficiary.firstName, lastname: discussion.potentialBeneficiary.lastName })} - via Immersion Facilitée`,
    },
  };

  const templatedContent: TemplatedEmail = isLegacy
    ? {
        ...commonTemplatedContent,
        kind: "CONTACT_BY_EMAIL_REQUEST_LEGACY",
        params: {
          appellationLabel: appellation.appellationLabel,
          businessName: discussion.businessName,
          businessAddress: addressDtoToString(discussion.address),
          immersionObjective:
            discussion.potentialBeneficiary.immersionObjective ?? undefined,
          potentialBeneficiaryFirstName: getFormattedFirstnameAndLastname({
            firstname: discussion.potentialBeneficiary.firstName,
          }),
          potentialBeneficiaryLastName: getFormattedFirstnameAndLastname({
            lastname: discussion.potentialBeneficiary.lastName,
          }),
          potentialBeneficiaryPhone: discussion.potentialBeneficiary.phone,
          potentialBeneficiaryResumeLink:
            discussion.kind === "IF"
              ? discussion.potentialBeneficiary.resumeLink
              : undefined,
          message: sort(ascend(prop("sentAt")), discussion.exchanges)[0]
            .message,
          replyToEmail: opaqueEmail,
        },
      }
    : {
        ...commonTemplatedContent,
        ...makeContactByEmailRequestParams({
          appellation,
          discussion,
          immersionFacileBaseUrl: deps.immersionFacileBaseUrl,
        }),
      };

  await deps.saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent,
    followedIds: { establishmentSiret: discussion.siret },
  });
};

const getOtherContactModeParams = ({
  discussion,
  establishmentUserToContact,
  establishmentUserRightToContact,
}: {
  discussion: DiscussionDto;
  establishmentUserToContact: UserWithAdminRights;
  establishmentUserRightToContact: EstablishmentUserRight;
}) => {
  const common = {
    businessName: discussion.businessName,
    contactFirstName: getFormattedFirstnameAndLastname({
      firstname: establishmentUserToContact.firstName,
    }),
    contactLastName: getFormattedFirstnameAndLastname({
      lastname: establishmentUserToContact.lastName,
    }),
    kind: discussion.kind,
    potentialBeneficiaryFirstName: getFormattedFirstnameAndLastname({
      firstname: discussion.potentialBeneficiary.firstName,
    }),
    potentialBeneficiaryLastName: getFormattedFirstnameAndLastname({
      lastname: discussion.potentialBeneficiary.lastName,
    }),
  };
  if (
    discussion.contactMode === "PHONE" &&
    establishmentUserRightToContact.phone
  ) {
    return {
      kind: "CONTACT_BY_PHONE_INSTRUCTIONS" as const,
      params: {
        ...common,
        contactPhone: establishmentUserRightToContact.phone,
      },
    };
  }
  return {
    kind: "CONTACT_IN_PERSON_INSTRUCTIONS" as const,
    params: {
      ...common,
      welcomeAddress: addressDtoToString(discussion.address),
    },
  };
};
