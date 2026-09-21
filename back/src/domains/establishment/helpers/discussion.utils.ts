import { renderContent } from "html-templates/src/components/email";
import {
  type BrevoEmailItem,
  type DiscussionDto,
  type DiscussionId,
  type Email,
  type ExchangeRole,
  errors,
  immersionFacileContactEmail,
  makeExchangeEmailSchema,
  type User,
} from "shared";
import type { EstablishmentUserRight } from "../entities/EstablishmentAggregate";

const defaultSubject = "Sans objet";

export const getDiscussionParamsFromEmail = (
  email: Email,
  replyDomain: string,
): { discussionId: DiscussionId; recipientRole: ExchangeRole } => {
  const validatedEmail = makeExchangeEmailSchema(replyDomain).safeParse(email);
  if (!validatedEmail.success)
    throw errors.discussion.badEmailFormat({
      email,
    });

  const recipientEmailParams = validatedEmail.data;

  const { discussionId, rawRecipientKind } = recipientEmailParams;

  if (!["e", "b"].includes(rawRecipientKind))
    throw errors.discussion.badRecipientKindFormat({ kind: rawRecipientKind });

  return {
    discussionId,
    recipientRole:
      rawRecipientKind === "e" ? "establishment" : "potentialBeneficiary",
  };
};

const cleanContactEmailFromMessage = (message: string) =>
  message
    .replaceAll(`<${immersionFacileContactEmail}>`, "")
    .replaceAll(
      `&lt;<a href="mailto:${immersionFacileContactEmail}">${immersionFacileContactEmail}</a>&gt;`,
      "",
    )
    .replaceAll(
      `&lt;<a href="mailto:${immersionFacileContactEmail}" target="_blank">${immersionFacileContactEmail}</a>&gt;`,
      "",
    );

export const processInboundParsingEmailMessage = (item: BrevoEmailItem) => {
  const emailContent =
    item.RawHtmlBody ||
    (item.RawTextBody &&
      renderContent(item.RawTextBody, {
        wrapInTable: false,
        replaceNewLines: true,
      })) ||
    "Pas de contenu";
  return cleanContactEmailFromMessage(emailContent);
};

export const getSubjectFromEmail = (item: BrevoEmailItem) =>
  item.Subject || defaultSubject;

export const hasUserRightToAccessDiscussion = async (
  user: User,
  discussion: DiscussionDto,
  estalishmentUserRights: EstablishmentUserRight[],
): Promise<boolean> => {
  if (user.email === discussion.potentialBeneficiary.email) return true;

  return estalishmentUserRights.some(
    (right) => right.userId === user.id && right.status === "ACCEPTED",
  );
};
