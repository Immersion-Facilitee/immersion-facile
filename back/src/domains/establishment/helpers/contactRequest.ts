import {
  type AppellationAndRomeDto,
  type DiscussionDto,
  type EmailParamsByEmailType,
  type Firstname,
  frontRoutes,
  immersionDurationLabels,
  type Lastname,
  makeRouteAbsoluteUrl,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";

type ContactByEmailRequest =
  | {
      kind: "CONTACT_BY_EMAIL_REQUEST_IMMERSION";
      params: EmailParamsByEmailType["CONTACT_BY_EMAIL_REQUEST_IMMERSION"];
    }
  | {
      kind: "CONTACT_BY_EMAIL_MINISTAGE";
      params: EmailParamsByEmailType["CONTACT_BY_EMAIL_MINISTAGE"];
    };

export const makeContactByEmailRequestParams = ({
  contactFirstName,
  contactLastName,
  discussion,
  immersionFacileBaseUrl,
  appellation,
}: {
  contactFirstName?: Firstname;
  contactLastName?: Lastname;
  discussion: DiscussionDto;
  immersionFacileBaseUrl: AppConfig["immersionFacileBaseUrl"];
  appellation: AppellationAndRomeDto;
}): ContactByEmailRequest => {
  const commonParams = {
    appellationLabel: appellation.appellationLabel,
    businessName: discussion.businessName,
    businessAddress: `${discussion.address.streetNumberAndAddress} ${discussion.address.postcode} ${discussion.address.city}`,
    contactFirstName,
    contactLastName,
    discussionUrl: makeRouteAbsoluteUrl({
      route: frontRoutes.establishmentDashboardDiscussions({
        discussionId: discussion.id,
        at_campaign: "inbound-parsing-reponse-via-espace-entreprise",
        at_kwd: "inbound-parsing-reponse-via-espace-entreprise",
      }),
      baseUrl: immersionFacileBaseUrl,
    }),
    potentialBeneficiaryFirstName: discussion.potentialBeneficiary.firstName,
    potentialBeneficiaryLastName: discussion.potentialBeneficiary.lastName,
    potentialBeneficiaryPhone: discussion.potentialBeneficiary.phone,
    potentialBeneficiaryDatePreferences:
      discussion.potentialBeneficiary.datePreferences,
  };

  return discussion.kind === "IF"
    ? {
        kind: "CONTACT_BY_EMAIL_REQUEST_IMMERSION",
        params: {
          ...commonParams,
          immersionObjective:
            discussion.potentialBeneficiary.immersionObjective ?? undefined,
          potentialBeneficiaryDurationPreferences:
            immersionDurationLabels[
              discussion.potentialBeneficiary.immersionDuration
            ],
          potentialBeneficiaryExperienceAdditionalInformation:
            discussion.potentialBeneficiary.experienceAdditionalInformation,
          potentialBeneficiaryMotivation:
            discussion.potentialBeneficiary.motivation,
          potentialBeneficiaryResumeLink:
            discussion.potentialBeneficiary.resumeLink,
        },
      }
    : {
        kind: "CONTACT_BY_EMAIL_MINISTAGE",
        params: {
          ...commonParams,
          levelOfEducation: discussion.potentialBeneficiary.levelOfEducation,
        },
      };
};
