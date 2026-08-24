import {
  type AppellationAndRomeDto,
  type DiscussionDto,
  type EmailParamsByEmailType,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";

export const makeContactByEmailRequestParams = ({
  discussion,
  immersionFacileBaseUrl,
  appellation,
}: {
  discussion: DiscussionDto;
  immersionFacileBaseUrl: AppConfig["immersionFacileBaseUrl"];
  appellation: AppellationAndRomeDto;
}): EmailParamsByEmailType["CONTACT_BY_EMAIL_REQUEST"] => ({
  replyToEmail: discussion.potentialBeneficiary.email,
  appellationLabel: appellation.appellationLabel,
  discussionUrl: makeRouteAbsoluteUrl({
    route: frontRoutes.establishmentDashboardDiscussions({
      discussionId: discussion.id,
      at_campaign: "inbound-parsing-reponse-via-espace-entreprise",
      at_kwd: "inbound-parsing-reponse-via-espace-entreprise",
    }),
    baseUrl: immersionFacileBaseUrl,
  }),
  businessName: discussion.businessName,
  businessAddress: `${discussion.address.streetNumberAndAddress} ${discussion.address.postcode} ${discussion.address.city}`,
  potentialBeneficiaryFirstName: getFormattedFirstnameAndLastname({
    firstname: discussion.potentialBeneficiary.firstName,
  }),
  potentialBeneficiaryLastName: getFormattedFirstnameAndLastname({
    lastname: discussion.potentialBeneficiary.lastName,
  }),
  potentialBeneficiaryPhone: discussion.potentialBeneficiary.phone,
  potentialBeneficiaryDatePreferences:
    discussion.potentialBeneficiary.datePreferences,
  ...(discussion.kind === "IF"
    ? {
        kind: discussion.kind,
        immersionObjective:
          discussion.potentialBeneficiary.immersionObjective ?? undefined,
        potentialBeneficiaryResumeLink:
          discussion.potentialBeneficiary.resumeLink,
        potentialBeneficiaryExperienceAdditionalInformation:
          discussion.potentialBeneficiary.experienceAdditionalInformation,
      }
    : {
        kind: discussion.kind,
        immersionObjective: discussion.potentialBeneficiary.immersionObjective,
        levelOfEducation: discussion.potentialBeneficiary.levelOfEducation,
      }),
});
