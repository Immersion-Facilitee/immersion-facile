import { ConventionDtoBuilder, type TallyForm } from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../unit-of-work/adapters/InMemoryUowPerformer";
import { InMemoryCrispApi } from "../adapters/InMemoryCrispApi";
import type { InitiateCrispConversationParams } from "../ports/CrispGateway";
import {
  makeSendSupportTicketToCrisp,
  type SendSupportTicketToCrisp,
} from "./SendSupportTicketToCrisp";
import {
  assessmentLink,
  conventionFromTally,
  conventionWithAssessment,
  crispDeleteReason,
  crispMessageContent,
  crispTicketSiret,
  johnDoeEmail,
  makeTallyFormCase2WithConventionId,
  makeTallyFormCase7WithAssessment,
  tallyFormCase0TicketToSkip,
  tallyFormCase1,
  tallyFormCase3,
  tallyFormCase4Establishment,
  tallyFormCase5,
  tallyFormCase6,
} from "./SendSupportTicketToCrisp.testData";

describe("SendSupportTicketToCrisp", () => {
  const convention = new ConventionDtoBuilder()
    .withId(conventionFromTally)
    .build();
  const conventionWithAssessmentLink = new ConventionDtoBuilder()
    .withId(conventionWithAssessment)
    .withBusinessName("Test Business")
    .withBeneficiaryFirstName("John")
    .withBeneficiaryLastName("Doe")
    .withBeneficiaryEmail(johnDoeEmail)
    .withBeneficiaryPhone("0123456789")
    .withEstablishmentRepresentativeFirstName("Jane")
    .withEstablishmentRepresentativeLastName("Smith")
    .withEstablishmentTutor({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@test.com",
      phone: "0123456789",
      job: "Manager",
      role: "establishment-tutor",
    })
    .build();
  let sendSupportTicketToCrisp: SendSupportTicketToCrisp;
  let uow: InMemoryUnitOfWork;
  let crispApi: InMemoryCrispApi;

  beforeEach(() => {
    uow = createInMemoryUow();
    crispApi = new InMemoryCrispApi();
    uow.conventionRepository.setConventions([
      convention,
      conventionWithAssessmentLink,
    ]);
    uow.notificationRepository.save({
      id: "test-notification-id",
      kind: "email",
      createdAt: new Date().toISOString(),
      templatedContent: {
        kind: "ASSESSMENT_CREATED_ESTABLISHMENT_NOTIFICATION",
        recipients: [conventionWithAssessmentLink.establishmentTutor.email],
        params: {
          recipientFullName: `${conventionWithAssessmentLink.establishmentTutor.firstName} ${conventionWithAssessmentLink.establishmentTutor.lastName}`,
          beneficiaryFullName: `${conventionWithAssessmentLink.signatories.beneficiary.firstName} ${conventionWithAssessmentLink.signatories.beneficiary.lastName}`,
          businessName: conventionWithAssessmentLink.businessName,
          linkToAssessment: assessmentLink,
          internshipKind: conventionWithAssessmentLink.internshipKind,
        },
      },
      followedIds: {
        conventionId: conventionWithAssessment,
      },
    });
    sendSupportTicketToCrisp = makeSendSupportTicketToCrisp({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        crispApi,
      },
    });
  });

  describe("It creates a ticket on crisp from different usecases", () => {
    it.each([
      {
        name: "case 0",
        tallyForm: tallyFormCase0TicketToSkip,
        expectNotCalled: true,
      },
      {
        name: "case 1",
        tallyForm: tallyFormCase1,
        expectedParams: {
          message: crispMessageContent,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Retrouver la convention par Email de bénéficiaire:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?email_b%25C3%25A9n%25C3%25A9ficiaire=${johnDoeEmail}

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "beneficiaire"],
          },
        },
      },
      {
        name: "case 2, with convention ID",
        tallyForm: makeTallyFormCase2WithConventionId(conventionFromTally),
        expectedParams: {
          message: crispMessageContent,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Convention ID: ${conventionFromTally}
Type de convention: immersion

Pilotage admin:
https://immersion-facile.beta.gouv.fr/admin/conventions/${conventionFromTally}

Liste de conventions:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?id_de_convention=${conventionFromTally}

Liens magiques de cette convention:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_numero_de_convention=${conventionFromTally}

Bilan:
Pas de lien de bilan

-----------
Retrouver la convention par Email de bénéficiaire:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?email_b%25C3%25A9n%25C3%25A9ficiaire=${johnDoeEmail}

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "beneficiaire", "immersion"],
          },
        },
      },
      {
        name: "case 2bis, with convention ID, but invalid",
        tallyForm: makeTallyFormCase2WithConventionId(
          "wrong-format-convention-id",
        ),
        expectedParams: {
          message: crispMessageContent,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Convention ID: wrong-format-convention-id - Format invalide

-----------
Retrouver la convention par Email de bénéficiaire:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?email_b%25C3%25A9n%25C3%25A9ficiaire=${johnDoeEmail}

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "beneficiaire"],
          },
        },
      },
      {
        name: "case 3, whatever",
        tallyForm: tallyFormCase3,
        expectedParams: {
          message: crispMessageContent,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "prescripteur"],
          },
        },
      },
      {
        name: "case 4, with siret",
        tallyForm: tallyFormCase4Establishment,
        expectedParams: {
          message: `Demande de suppression d'entreprise pour la raison suivante: ${crispDeleteReason}`,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Siret fourni : ${crispTicketSiret}
Piloter l'entreprise (dont suppression): https://immersion-facile.beta.gouv.fr/admin/establishments/${crispTicketSiret}

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "entreprise", "suppression-entreprise"],
          },
        },
      },
      {
        name: "case 5",
        tallyForm: tallyFormCase5,
        expectedParams: {
          message: crispMessageContent,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Convention ID: 76f8f40b-1b43-4623-8592-47209b1e7dfb - Non trouvée dans la base de données

-----------
Retrouver la convention par Email de l'entreprise:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?email_repr%25C3%25A9sentant_de_l%27entreprise=john.doe@gmail.com

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: [
              "email",
              "modification",
              "beneficiaire",
              "pour-prescripteur",
            ],
          },
        },
      },
      {
        name: "case 6, suppression entreprise",
        tallyForm: tallyFormCase6,
        expectedParams: {
          message: "Demande de suppression d'entreprise",
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Siret fourni : ${crispTicketSiret}
Piloter l'entreprise (dont suppression): https://immersion-facile.beta.gouv.fr/admin/establishments/${crispTicketSiret}

Pour quelle raison principale souhaitez-vous arrêter d'accueillir d'immersions professionnelles:
Je reçois trop de demandes

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "entreprise", "suppression-entreprise"],
          },
        },
      },
      {
        name: "case 7, with assessment link",
        tallyForm: makeTallyFormCase7WithAssessment(),
        expectedParams: {
          message: crispMessageContent,
          helperNote: `Liens magiques (de la personne écrivant au support):
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_email=${johnDoeEmail}

-----------
Convention ID: ${conventionWithAssessment}
Type de convention: immersion

Pilotage admin:
https://immersion-facile.beta.gouv.fr/admin/conventions/${conventionWithAssessment}

Liste de conventions:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?id_de_convention=${conventionWithAssessment}

Liens magiques de cette convention:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/102?filtrer_par_numero_de_convention=${conventionWithAssessment}

Bilan:
Lien de complétion du bilan: ${assessmentLink}
Email du tuteur: ${conventionWithAssessmentLink.establishmentTutor.email}

-----------
Retrouver la convention par Email de bénéficiaire:
https://metabase.immersion-facile.beta.gouv.fr/dashboard/5?email_b%25C3%25A9n%25C3%25A9ficiaire=${johnDoeEmail}

-----------
Logs Brevo:
https://app-smtp.brevo.com/log
`,
          metadata: {
            email: johnDoeEmail,
            segments: ["email", "beneficiaire", "immersion"],
          },
        },
      },
    ] satisfies Array<
      { name: string; tallyForm: TallyForm } & (
        | { expectNotCalled: true }
        | { expectedParams: InitiateCrispConversationParams }
      )
    >)(
      "Ticket on crisp: $name",
      async ({ tallyForm, expectedParams, expectNotCalled }) => {
        await sendSupportTicketToCrisp.execute(tallyForm);
        expectNotCalled
          ? expectCrispInitiatedConversationParams([])
          : expectCrispInitiatedConversationParams([expectedParams]);
      },
    );
  });

  const expectCrispInitiatedConversationParams = (
    params: InitiateCrispConversationParams[],
  ) => {
    expect(crispApi.initiatedConversationParams).toEqual(params);
  };
});
