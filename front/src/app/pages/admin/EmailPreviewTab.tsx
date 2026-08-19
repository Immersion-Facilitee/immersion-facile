import { fr } from "@codegouvfr/react-dsfr";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { configureGenerateHtmlFromTemplate } from "html-templates";
import {
  cciCustomHtmlHeader,
  defaultEmailFooter,
} from "html-templates/src/components/email";
import { toPairs } from "ramda";
import { useState } from "react";
import { ImmersionTextField } from "react-design-system";
import {
  addressDtoToString,
  domElementIds,
  type EmailTemplatesByName,
  emailTemplatesByName,
  internshipKinds,
  loginByEmailLinkDurationInMinutes,
} from "shared";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { useStyles } from "tss-react/dsfr";

const defaultEmailPreviewUrl =
  "https://upload.wikimedia.org/wikipedia/en/9/9a/Trollface_non-free.png";

type TemplateName = keyof EmailTemplatesByName;

export const EmailPreviewTab = () => {
  const { cx } = useStyles();

  const [currentTemplate, setCurrentTemplate] = useState<TemplateName>(
    "AGENCY_WAS_ACTIVATED",
  );

  const [emailVariables, setEmailVariables] = useState(
    defaultEmailValueByEmailKind[currentTemplate],
  );

  const fakeContent = configureGenerateHtmlFromTemplate(
    emailTemplatesByName,
    "internshipKind" in emailVariables &&
      emailVariables.internshipKind === "mini-stage-cci"
      ? {
          header: cciCustomHtmlHeader,
          footer: () => defaultEmailFooter("mini-stage-cci"),
        }
      : { footer: undefined, header: undefined },
  )(currentTemplate, emailVariables, {
    skipHead: true,
  });

  const onTemplateChange = (templateName: TemplateName) => {
    setCurrentTemplate(templateName);
    setEmailVariables(defaultEmailValueByEmailKind[templateName]);
  };

  return (
    <BackofficeDashboardTabContent title="Aperçu de template email">
      <div>
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          <aside className={fr.cx("fr-col-12", "fr-col-lg-4")}>
            <Select
              label="Liste de templates email :"
              placeholder="Veuillez sélectionner un template email"
              options={toPairs(emailTemplatesByName)
                .map(([key, { niceName }]) => ({
                  label: niceName,
                  value: key,
                }))
                .sort((a, b) => a.label.localeCompare(b.label))}
              nativeSelectProps={{
                id: domElementIds.admin.emailPreviewTab.emailTemplateNameSelect,
                name: "templateName",
                onChange: (event) =>
                  onTemplateChange(event.currentTarget.value),
              }}
            />

            <h6>Métadonnées</h6>
            <ul className={fr.cx("fr-badge-group")}>
              <li>
                <span className={fr.cx("fr-badge", "fr-badge--green-menthe")}>
                  Sujet
                </span>
              </li>
              <li>{fakeContent.subject}</li>
            </ul>
            {fakeContent.tags && fakeContent.tags.length > -1 && (
              <ul className={fr.cx("fr-badge-group", "fr-mt-2w")}>
                <li>
                  <span className={fr.cx("fr-badge", "fr-badge--blue-ecume")}>
                    Tags
                  </span>
                </li>
                <li>{fakeContent.tags.join(", ")}</li>
              </ul>
            )}

            <h6 className={fr.cx("fr-mt-4w")}>Données de prévisualisation</h6>
            <ul>
              {Object.keys(emailVariables)
                .sort()
                .map((variableName) => (
                  <li key={variableName}>
                    <EmailVariableField
                      variableName={variableName}
                      variableValue={
                        emailVariables[
                          variableName as keyof typeof emailVariables
                        ]
                      }
                      onChange={(value) =>
                        setEmailVariables({
                          ...emailVariables,
                          [variableName]: value,
                        })
                      }
                    />
                  </li>
                ))}
            </ul>
            <h6 className={fr.cx("fr-mt-4w")}>Pièces jointes</h6>
            {fakeContent.attachment ? (
              <ul>
                {fakeContent.attachment.map((att) => {
                  if ("url" in att) {
                    return (
                      <li key={att.url}>
                        <a target={"_blank"} href={att.url} rel="noreferrer">
                          {att.url}
                        </a>
                      </li>
                    );
                  }
                  return <li key={att.name}>{att.name}</li>;
                })}
              </ul>
            ) : (
              <p>Ce template de mail n'a pas de pièces jointes.</p>
            )}
          </aside>
          <section className={fr.cx("fr-col-12", "fr-col-lg-8")}>
            <div
              className={cx("admin-tab__email-preview-wrapper")}
              dangerouslySetInnerHTML={{ __html: fakeContent.htmlContent }}
            />
          </section>
        </div>
      </div>
    </BackofficeDashboardTabContent>
  );
};

type EmailVariableFieldProps = {
  variableName: string;
  variableValue: any;
  onChange(value: any): void;
};
const EmailVariableField = ({
  variableName,
  variableValue,
  onChange,
}: EmailVariableFieldProps): JSX.Element => {
  if (variableName === "internshipKind")
    return (
      <Select
        label={variableName}
        options={internshipKinds.map((internshipKind) => ({
          label: internshipKind,
          value: internshipKind,
        }))}
        className={fr.cx("fr-mb-2w")}
        nativeSelectProps={{
          id: domElementIds.admin.emailPreviewTab.internshipKindSelect,
          name: variableName,
          onChange: (e) => onChange(e.target.value),
          value: variableValue,
        }}
      />
    );
  if (["string", "number", "undefined"].includes(typeof variableValue))
    return (
      <ImmersionTextField
        label={variableName}
        name={variableName}
        value={variableValue ?? ""}
        className={fr.cx("fr-mb-2w")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <div className={fr.cx("fr-input-group", "fr-mb-2w")}>
      <p className={fr.cx("fr-label")}>{variableName}</p>
      <pre className={fr.cx("fr-text--xs", "fr-m-auto")}>
        <code>{JSON.stringify(variableValue, null, 2)}</code>
      </pre>
    </div>
  );
};

export const defaultEmailValueByEmailKind: {
  [K in TemplateName]: Parameters<
    EmailTemplatesByName[K]["createEmailVariables"]
  >[0];
} = {
  LOGIN_BY_EMAIL_REQUESTED: {
    validMinutes: loginByEmailLinkDurationInMinutes,
    loginLink: "https://google.com",
    fullname: "BOB",
  },
  TEST_EMAIL: {
    input1: "input1",
    input2: "input2",
    url: "https://immersion-facile.beta.gouv.fr",
  },
  AGENCY_WAS_REJECTED: {
    agencyName: "AGENCY_NAME",
    statusJustification: "STATUS_JUSTIFICATION",
  },
  AGENCY_FIRST_REMINDER: {
    manageConventionLink: "CONVENTION_VERIFICATION_LINK",
    agencyReferentName: "AGENCY_REFERENT_NAME",
    agencyName: "AGENCY_NAME",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    dateStart: "DATE_START",
    dateEnd: "DATE_END",
  },
  AGENCY_LAST_REMINDER: {
    manageConventionLink: "MANAGE_CONVENTION_LINK",
    agencyReferentName: "AGENCY_REFERENT_NAME",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
  },
  AGENCY_HAS_BEEN_PUT_ON_HOLD: {
    agencyName: "AGENCY_NAME",
  },
  AGENCY_WAS_ACTIVATED: {
    agencyName: "AGENCY_NAME",
    agencyLogoUrl: defaultEmailPreviewUrl,
    refersToOtherAgency: true,
    agencyDashboardUrl:
      "https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence/dashboard",
    agencyReferdToName: "AGENCY_REFERS_TO_NAME",
  },
  AGENCY_OF_TYPE_OTHER_ADDED: {
    agencyName: "AGENCY_NAME",
    agencyLogoUrl: defaultEmailPreviewUrl,
  },
  AGENCY_REGISTRATION_REQUEST_CONFIRMATION: {
    immersionBaseUrl: "https://immersion-facile.beta.gouv.fr",
    agencies: [
      {
        agencyName: "Nom de l'organisme 1",
        adminEmails: ["admin1@organisme.fr", "admin2@organisme.fr"],
      },
      {
        agencyName: "Nom de l'organisme 2",
        adminEmails: [],
      },
    ],
  },
  ARCHIVED_CONVENTION_REQUEST_RECEIVED: {
    archivedConventionRequestId: "ARCHIVED_CONVENTION_REQUEST_ID",
  },
  AGENCY_WITH_REFERS_TO_ACTIVATED: {
    nameOfAgencyRefering: "ACCOMPANYING_AGENCY_NAME",
    refersToAgencyName: "REFERS_TO_AGENCY_NAME",
    agencyLogoUrl: defaultEmailPreviewUrl,
    validatorEmails: ["VALIDATOR_EMAIL1", "VALIDATOR_EMAIL2"],
  },
  ACCOUNT_DELETION_WARNING: {
    fullName: "FIRST_NAME LAST_NAME",
    deletionDate: "22 janvier 2026",
    loginUrl: "https://immersion-facile.beta.gouv.fr/mon-profil",
  },
  AGENCY_ADMIN_NEW_USERS_TO_REVIEW_NOTIFICATION: {
    firstName: "FIRST_NAME",
    lastName: "LAST_NAME",
    immersionBaseUrl: "https://immersion-facile.beta.gouv.fr",
    agencies: [
      {
        agencyName: "Nom de l'organisme 1",
        numberOfUsersToReview: 1,
      },
      {
        agencyName: "Nom de l'organisme 2",
        numberOfUsersToReview: 10,
      },
      {
        agencyName: "Nom de l'organisme 3",
        numberOfUsersToReview: 4,
      },
    ],
  },
  AGENCY_CLOSED_FOR_INACTIVITY: {
    agencyName: "AGENCY_NAME",
    numberOfMonthsWithoutConvention: 6,
  },
  AGENCY_DELEGATION_CONTACT_INFORMATION: {
    delegationProviderMail: "DELEGATION_PROVIDER_EMAIL",
  },
  AGENCY_DELEGATION_CONVENTION_EXPIRED: {
    agencyName: "AGENCY_NAME",
    delegationAgencyName: "DELEGATION_AGENCY_NAME",
    delegationAgencyKind: "france-travail",
  },
  AGENCY_DELEGATION_CONVENTION_EXPIRING_SOON: {
    agencyName: "AGENCY_NAME",
    delegationAgencyName: "DELEGATION_AGENCY_NAME",
    delegationEndDate: "2026-06-30T00:00:00.000Z",
    reminderKind: "oneMonthBefore",
  },
  ASSESSMENT_BENEFICIARY_NOTIFICATION: {
    conventionId: "CONVENTION_ID",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    internshipKind: "immersion",
    establishmentTutorEmail: "ESTABLISHMENT_TUTOR_EMAIL",
  },
  ASSESSMENT_AGENCY_NOTIFICATION: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    agencyReferentName: "AGENCY_REFERENT_NAME",
    manageConventionLink: "MANAGE_CONVENTION_LINK",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    tutorEmail: "TUTOR_EMAIL",
    conventionId: "CONVENTION_ID",
    internshipKind: "immersion",
  },
  ASSESSMENT_ESTABLISHMENT_NOTIFICATION: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    conventionId: "CONVENTION_ID",
    establishmentTutorName: "ESTABLISHMENT_TUTOR_NAME",
    assessmentCreationLink: "ASSESSMENT_CREATION_LINK",
    internshipKind: "immersion",
  },
  ASSESSMENT_ESTABLISHMENT_REMINDER: {
    assessmentCreationLink: "ASSESSMENT_CREATION_LINK",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    establishmentTutorFirstName: "ESTABLISHMENT_TUTOR_FIRST_NAME",
    establishmentTutorLastName: "ESTABLISHMENT_TUTOR_LAST_NAME",
    conventionId: "CONVENTION_ID",
    internshipKind: "immersion",
  },
  ASSESSMENT_CREATED_ESTABLISHMENT_NOTIFICATION: {
    internshipKind: "immersion",
    beneficiaryFullName: "BENEFICIARY_FULL_NAME",
    recipientFullName: "RECIPIENT_FULL_NAME",
    businessName: "BUSINESS_NAME",
    linkToAssessment: "http://fake.url",
  },
  ASSESSMENT_DELETED_BENEFICIARY_NOTIFICATION: {
    internshipKind: "immersion",
    beneficiaryName: "BENEFICIARY_NAME",
    conventionId: "CONVENTION_ID",
  },
  ASSESSMENT_DELETED_ESTABLISHMENT_NOTIFICATION: {
    assessmentCreationLink: "ASSESSMENT_CREATION_LINK",
    beneficiaryName: "BENEFICIARY_NAME",
    establishmentTutorName: "ESTABLISHMENT_TUTOR_NAME",
    justification: "JUSTIFICATION",
    internshipKind: "immersion",
  },
  CANCELLED_CONVENTION_NOTIFICATION: {
    agencyName: "AGENCY",
    agencyLogoUrl: defaultEmailPreviewUrl,
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    immersionProfession: "IMMERSION_PROFESSION",
    internshipKind: "immersion",
    signature: "SIGNATURE",
    dateStart: "DATE_START",
    dateEnd: "DATE_END",
    justification: "JUSTIFICATION",
  },
  CONTACT_BY_EMAIL_REQUEST_LEGACY: {
    replyToEmail: "REPLY_TO_EMAIL",
    appellationLabel: "APPELLATION_LABEL",
    businessName: "BUSINESS_NAME",
    immersionObjective: "Découvrir un métier ou un secteur d'activité",
    message: "MESSAGE",
    potentialBeneficiaryFirstName: "POTENTIAL_BENEFICIARY_FIRST_NAME",
    potentialBeneficiaryLastName: "POTENTIAL_BENEFICIARY_LAST_NAME",
    potentialBeneficiaryPhone: "POTENTIAL_BENEFICIARY_PHONE",
    potentialBeneficiaryResumeLink: "POTENTIAL_BENEFICIARY_CV_OR_LINKEDIN",
    businessAddress: "BUSINESS_ADDRESS",
  },
  CONTACT_BY_EMAIL_REQUEST: {
    replyToEmail: "REPLY_TO_EMAIL",
    appellationLabel: "APPELLATION_LABEL",
    businessName: "BUSINESS_NAME",
    immersionObjective: "Découvrir un métier ou un secteur d'activité",
    potentialBeneficiaryFirstName: "POTENTIAL_BENEFICIARY_FIRST_NAME",
    potentialBeneficiaryLastName: "POTENTIAL_BENEFICIARY_LAST_NAME",
    potentialBeneficiaryPhone: "POTENTIAL_BENEFICIARY_PHONE",
    potentialBeneficiaryResumeLink: "POTENTIAL_BENEFICIARY_CV_OR_LINKEDIN",
    businessAddress: "BUSINESS_ADDRESS",
    potentialBeneficiaryDatePreferences:
      "POTENTIAL_BENEFICIARY_DATE_PREFERENCES",
    potentialBeneficiaryExperienceAdditionalInformation:
      "POTENTIAL_BENEFICIARY_EXPERIENCE_ADDITIONAL_INFORMATION",
    discussionUrl: "https://immersion-facile.beta.gouv.fr",
    kind: "IF",
  },
  CONTACT_BY_EMAIL_CANDIDATE_CONFIRMATION: {
    businessName: "BUSINESS_NAME",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    kind: "IF",
    beneficiaryDashboardUrl: "http://example.com",
  },
  CONTACT_BY_PHONE_INSTRUCTIONS: {
    businessName: "BUSINESS_NAME",
    contactFirstName: "CONTACT_FIRST_NAME",
    contactLastName: "CONTACT_LAST_NAME",
    contactPhone: "CONTACT_PHONE",
    kind: "IF",
    potentialBeneficiaryFirstName: "POTENTIAL_BENEFICIARY_FIRST_NAME",
    potentialBeneficiaryLastName: "POTENTIAL_BENEFICIARY_LAST_NAME",
  },
  CONTACT_IN_PERSON_INSTRUCTIONS: {
    businessName: "BUSINESS_NAME",
    contactFirstName: "CONTACT_FIRST_NAME",
    contactLastName: "CONTACT_LAST_NAME",
    welcomeAddress: "WELCOME_ADDRESS",
    kind: "IF",
    potentialBeneficiaryFirstName: "POTENTIAL_BENEFICIARY_FIRST_NAME",
    potentialBeneficiaryLastName: "POTENTIAL_BENEFICIARY_LAST_NAME",
  },
  CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION: {
    conventionId: "CONVENTION_ID",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    beneficiaryEmail: "BENEFICIARY_EMAIL",
    beneficiaryPhone: "BENEFICIARY_PHONE",
    previousAgencyName: "PREVIOUS_AGENCY_NAME",
    justification: "JUSTIFICATION",
    manageConventionLink: "MANAGE_CONVENTION_LINK",
    internshipKind: "immersion",
  },
  CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION: {
    conventionId: "CONVENTION_ID",
    businessName: "BUSINESS_NAME",
    internshipKind: "immersion",
    magicLink: "MAGIC_LINK",
    immersionProfession: "IMMERSION_PROFESSION",
    previousAgencyName: "PREVIOUS_AGENCY_NAME",
    newAgencyName: "NEW_AGENCY_NAME",
    agencyAddress: "AGENCY_ADDRESS",
    justification: "JUSTIFICATION",
  },
  DEPRECATED_CONVENTION_NOTIFICATION: {
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    dateStart: "DATE_START",
    dateEnd: "DATE_END",
    deprecationReason: "DEPRECATION_REASON",
    immersionProfession: "IMMERSION_PROFESSION",
    internshipKind: "immersion",
  },
  DISCUSSION_EXCHANGE: {
    subject: "SUBJECT",
    htmlContent:
      '<div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">Pour rappel, voici les informations liées à cette mise en relation :<br/><ul><li>Candidat : yolo lala</li><li>Métier : Boucher-charcutier / Bouchère-charcutière</li><li>Entreprise : France Merguez Distribution - 30 avenue des champs Elysées 75017 Paris</li></ul><br/> ---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:57<br>Subject: Fwd: Hey !<br>To: &lt;<a href="mailto:tristan@reply-dev.immersion-facile.beta.gouv.fr">tristan@reply-dev.immersion-facile.beta.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com" target="_blank">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:55<br>Subject: Hey !<br>To: &lt;<a href="mailto:roger@reply-dev.immersion-facile.gouv.fr" target="_blank">roger@reply-dev.immersion-facile.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><div><br clear="all"></div><div>Comment ça va ?</div><div><br></div><div><img src="cid:ii_ljff7lfo0" alt="IMG_20230617_151239.jpg" style="margin-right:0px" width="223" height="167"></div><div><br></div><div><br></div><div>A + !<br></div><div><br></div><div><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div></div>\r\n</div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div>\r\n</div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div>\r\n',
  },
  DISCUSSION_EXCHANGE_FORBIDDEN: {
    reason: "user_unknown_or_missing_rights_on_establishment",
    sender: "establishment",
    requestEstablishmentRegistrationUrl:
      "https://www.fake-immersion-facile-base-url.com/rattachement-entreprise?siret=12345678901234",
    establishmentName: "ESTABLISHMENT_NAME",
  },
  WARN_DISCUSSION_DELIVERY_FAILED: {
    recipientsInEmailInError: ["undelivered@email.com", "whatever@email.com"],
    errorMessage: "Error unspported attachement format : +outlook-bidule-truc",
  },
  ESTABLISHMENT_CONTACT_REQUEST_REMINDER: {
    appellationLabel: "Conducteur Poids Lourd",
    beneficiaryFirstName: "Coco",
    beneficiaryLastName: "Channel",
    beneficiaryReplyToEmail: "coco.chanel@notExistEmail.com",
    domain: "immersion-facile.beta.gouv.fr",
    mode: "3days",
  },
  ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS: {
    businessName: "Machin CORP",
    siret: "12345678901234",
  },
  ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY: {
    businessName: "Machin CORP",
    beneficiaryFirstName: "Gwenola",
    beneficiaryLastName: "Kornac'h",
    immersionBaseUrl: "https://immersion-facile.beta.gouv.fr",
  },
  ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR: {
    conventionId: "CONVENTION_ID",
    businessName: "Ker Anna",
    beneficiaryFirstName: "Gwenola",
    beneficiaryLastName: "Kornac'h",
    immersionBaseUrl: "https://immersion-facile.beta.gouv.fr",
  },
  ESTABLISHMENT_DELETED: {
    businessAddresses: [
      addressDtoToString({
        city: "CHOUCHEN-VILLE",
        departmentCode: "666",
        postcode: "66600",
        streetNumberAndAddress: "666 boulevard des porcs",
      }),
    ],
    businessName: "Machin CORP",
    siret: "12345678901234",
  },
  ESTABLISHMENT_LEAD_REMINDER: {
    businessName: "BUSINESS_NAME",
    registerEstablishmentShortLink: "REGISTRATION_LINK",
    unsubscribeToEmailShortLink: "REJECT_REGISTRATION_LINK",
  },
  FULL_PREVIEW_EMAIL: {
    internshipKind: "immersion",
    beneficiaryName: "BENEFICIARY_NAME",
    conventionId: "CONVENTION_ID",
    conventionStatusLink: "CONVENTION_STATUS_LINK",
    agencyLogoUrl: defaultEmailPreviewUrl,
  },
  IC_USER_REGISTRATION_TO_AGENCY_REJECTED: {
    agencyName: "AGENCY_NAME",
    justification: "REASON",
  },
  IC_USER_RIGHTS_HAS_CHANGED: {
    agencyName: "AGENCY_NAME",
    roles: ["validator"],
    isNotifiedByEmail: true,
    email: "USER_EMAIL",
    firstName: "USER_FIRST_NAME",
    lastName: "USER_LAST_NAME",
  },
  MAGIC_LINK_RENEWAL: {
    conventionId: "CONVENTION_ID",
    internshipKind: "immersion",
    magicLink: "MAGIC_LINK",
  },
  ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION: {
    agencyReferentName: "AGENCY_REFERENT_NAME",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    conventionDateEnd: new Date("2025-01-13").toISOString(),
    immersionAppellationLabel: "APPELLATION_LABEL",
    assessment: {
      conventionId: "conv-id",
      beneficiaryAgreement: true,
      beneficiaryFeedback: "my super feedback",
      signedAt: new Date("2025-01-01").toISOString(),
      status: "PARTIALLY_COMPLETED",
      lastDayOfPresence: new Date("2025-01-11").toISOString(),
      numberOfMissedHours: 12,
      establishmentFeedback: "Super !",
      establishmentAdvices: "Forme toi",
      endedWithAJob: true,
      contractStartDate: new Date("2025-01-08").toISOString(),
      typeOfContract: "CDD < 6 mois",
    },
    numberOfHoursMade: "30h",
    immersionObjective: "Confirmer un projet professionnel",
    internshipKind: "immersion",
    manageConventionLink: "http://MANAGE_CONVENTION_LINK",
  },
  ASSESSMENT_CREATED_WITH_STATUS_DID_NOT_SHOW_AGENCY_NOTIFICATION: {
    agencyReferentName: "AGENCY_REFERENT_NAME",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    immersionObjective: "Confirmer un projet professionnel",
    internshipKind: "immersion",
    immersionAppellationLabel: "APPELLATION_LABEL",
  },
  ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION: {
    internshipKind: "immersion",
    conventionId: "CONVENTION_ID",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    magicLink: "http://MAGIC_LINK",
  },
  ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION: {
    conventionId: "CONVENTION_ID",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    internshipKind: "immersion",
    assessmentSignatureLink: "http://SIGNATURE_LINK",
  },
  NEW_CONVENTION_AGENCY_NOTIFICATION: {
    internshipKind: "immersion",
    agencyReferentName: "AGENCY_REFERENT_NAME",
    conventionId: "CONVENTION_ID",
    firstName: "FIRST_NAME",
    lastName: "LAST_NAME",
    dateStart: "DATE_START",
    dateEnd: "DATE_END",
    businessName: "BUSINESS_NAME",
    agencyName: "AGENCY_NAME",
    manageConventionLink: "http://MANAGE_CONVENTION_LINK",
    agencyLogoUrl: defaultEmailPreviewUrl,
    warning: "WARNING",
  },
  NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    beneficiaryName: "BENEFICIARY_NAME",
    beneficiaryRepresentativeName: undefined,
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    establishmentRepresentativeName: "ESTABLISHMENT_REPRESENTATIVE_NAME",
    establishmentTutorName: "ESTABLISHMENT_TUTOR_NAME",
    internshipKind: "immersion",
    conventionSignShortlink: "CONVENTION_SIGN_MAGIC_LINK",
    signatoryName: "SIGNATORY_NAME",
    beneficiaryCurrentEmployerName: "CURRENT_EMPLOYER_NAME",
    renewed: {
      from: "11111111-1111-4111-1111-111111111111",
      justification: "EXCELLENTE_RAISON_DE_RENOUVELLEMENT",
    },
  },
  NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    conventionSignShortlink: "http://www.google.fr",
    internshipKind: "immersion",
    justification: "REASON",
    signatoryFirstName: "SIGNATORY_FIRST_NAME",
    signatoryLastName: "SIGNATORY_LAST_NAME",
  },
  NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    agencyReferentName: "AGENCY_REFERENT_NAME",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    internshipKind: "immersion",
    manageConventionLink: "MANAGE_CONVENTION_LINK",
    possibleRoleAction: "POSSIBLE_ROLE_ACTION",
    validatorName: "VALIDATOR_NAME",
    peAdvisor: {
      email: "PE_ADVISOR_EMAIL",
      firstName: "PE_ADVISOR_FIRSTAME",
      lastName: "PE_ADVISOR_LASTNAME",
      recipientIsPeAdvisor: false,
    },
  },
  NEW_ESTABLISHMENT_CREATED_CONTACT_CONFIRMATION: {
    businessName: "BUSINESS_NAME",
    businessAddresses: ["BUSINESS_ADDRESS_1", "BUSINESS_ADDRESS_2"],
    appelationLabels: ["Boulanger", "Pâtissier"],
  },
  POLE_EMPLOI_ADVISOR_ON_CONVENTION_FULLY_SIGNED: {
    advisorFirstName: "ADVISOR_FIRST_NAME",
    advisorLastName: "ADVISOR_LAST_NAME",
    immersionAddress: "IMMERSION_ADDRESS",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    beneficiaryEmail: "BENEFICIARY_EMAIL",
    conventionId: "CONVENTION_ID",
    dateStart: "DATE_START",
    dateEnd: "DATE_END",
    businessName: "BUSINESS_NAME",
    manageConventionLink: "MANAGE_CONVENTION_LINK",
    agencyLogoUrl: defaultEmailPreviewUrl,
  },
  REJECTED_CONVENTION_NOTIFICATION: {
    agencyName: "AGENCY",
    agencyLogoUrl: defaultEmailPreviewUrl,
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    immersionProfession: "IMMERSION_PROFESSION",
    internshipKind: "immersion",
    rejectionReason: "REJECTION_REASON",
    signature: "SIGNATURE",
  },
  SHARE_CONVENTION_DRAFT_RECIPIENT: {
    internshipKind: "immersion",
    additionalDetails: "ADDITIONAL_DETAILS",
    conventionFormUrl: "CONVENTION_FORM_URL",
  },
  SHARE_CONVENTION_DRAFT_SENDER: {
    internshipKind: "immersion",
    conventionFormUrl: "CONVENTION_FORM_URL",
  },
  SIGNATORY_REMINDER: {
    actorFirstName: "ACTOR_FIRSTNAME",
    actorLastName: "ACTOR_LASTNAME",
    beneficiaryFirstName: "BENEFICIARY_FIRSTNAME",
    beneficiaryLastName: "BENEFICIARY_LASTNAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    signatoriesSummary: [
      "- √  - A signé le 19/03/2023 - BENEFICIARY_FIRSTNAME BENEFICIARY_LASTNAME, bénéficiaire",
      `- ❌ - N'a pas signé - BENEFICIARY_CURRENT_EMPLOYER_FIRSTNAME BENEFICIARY_CURRENT_EMPLOYER_FIRSTNAME, employeur actuel du bénéficiaire`,
      `- ❌ - N'a pas signé - ESTABLISHMENT_REPRESENTATIVE_FIRSTNAME ESTABLISHMENT_REPRESENTATIVE_FIRSTNAME, représentant l'entreprise BUSINESS_NAME`,
    ].join("\n"),
    magicLinkUrl: "http://----MAGICLINK----",
  },
  SIGNEE_HAS_SIGNED_CONVENTION: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    conventionId: "CONVENTION_ID",
    magicLink: "http://CONVENTION_STATUS_LINK",
    internshipKind: "immersion",
    signedAt: new Date().toISOString(),
    agencyName: "AGENCY_NAME",
  },
  ESTABLISHMENT_REENGAGEMENT_SUGGESTION: {
    businessName: "BUSINESS_NAME",
  },
  VALIDATED_CONVENTION_FINAL_CONFIRMATION: {
    agencyLogoUrl: defaultEmailPreviewUrl,
    beneficiaryBirthdate: "BENEFICIARY_BIRTHDATE",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    conventionId: "CONVENTION_ID",
    dateEnd: "DATE_END",
    dateStart: "DATE_START",
    emergencyContactInfos: "EMERGENCY_CONTACT_INFOS",
    establishmentTutorName: "ESTABLISHMENT_TUTOR_NAME",
    immersionAppellationLabel: "IMMERSION_APPELLATION_LABEL",
    internshipKind: "immersion",
    magicLink: "MAGIC_LINK",
    assessmentMagicLink: "ASSESSMENT_MAGIC_LINK",
    validatorName: "VALIDATOR_NAME",
    agencyName: "AGENCY_NAME",
    agencyReferentName: "AGENCY_REFERENT_NAME",
  },
  ESTABLISHMENT_USER_RIGHTS_UPDATED: {
    businessName: "BUSINESS_NAME",
    firstName: "FIRST_NAME",
    lastName: "LAST_NAME",
    triggeredByUserFirstName: "ADMIN_FIRST_NAME",
    triggeredByUserLastName: "ADMIN_LAST_NAME",
    updatedRole: "establishment-contact",
  },
  ESTABLISHMENT_USER_RIGHTS_ADDED: {
    businessName: "BUSINESS_NAME",
    firstName: "FIRST_NAME",
    lastName: "LAST_NAME",
    triggeredByUserFirstName: "ADMIN_FIRST_NAME",
    triggeredByUserLastName: "ADMIN_LAST_NAME",
    role: "establishment-admin",
    immersionBaseUrl: "http://some-base-url.com",
  },
  ESTABLISHMENT_USER_RIGHTS_STATUS_UPDATED: {
    businessName: "BUSINESS_NAME",
    firstName: "FIRST_NAME",
    lastName: "LAST_NAME",
    triggeredByUserFirstName: "ADMIN_FIRST_NAME",
    triggeredByUserLastName: "ADMIN_LAST_NAME",
    updatedStatus: "ACCEPTED",
    immersionBaseUrl: "http://some-base-url.com",
  },
  DISCUSSION_DEPRECATED_NOTIFICATION_ESTABLISHMENT: {
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    establishmentDashboardUrl: "http://example.com",
    discussionCreatedAt: "2023-06-23T10:00:00.000Z",
  },
  DISCUSSION_DEPRECATED_NOTIFICATION_BENEFICIARY: {
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
    businessName: "BUSINESS_NAME",
    searchPageUrl: "http://example.com",
    discussionCreatedAt: "2023-06-23T10:00:00.000Z",
  },
  DISCUSSION_BENEFICIARY_FOLLOW_UP: {
    businessName: "BUSINESS_NAME",
    contactFirstName: "CONTACT_FIRST_NAME",
    contactLastName: "CONTACT_LAST_NAME",
    contactJob: "CONTACT_JOB",
    contactPhone: "CONTACT_PHONE",
    beneficiaryFirstName: "BENEFICIARY_FIRST_NAME",
    beneficiaryLastName: "BENEFICIARY_LAST_NAME",
  },
  ESTABLISHMENT_USER_RIGHT_IS_PENDING: {
    establishmentDashboardUrl: "http://example.com",
    adminFirstName: "ADMIN_FIRST_NAME",
    adminLastName: "ADMIN_LAST_NAME",
    pendingUserFirstName: "PENDING_USER_FIRST_NAME",
    pendingUserLastName: "PENDING_USER_LAST_NAME",
    pendingUserEmail: "PENDING_USER_EMAIL",
    pendingUserRole: "establishment-contact",
  },
};
