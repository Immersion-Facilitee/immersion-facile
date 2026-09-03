import {
  type CreateDiscussionDto,
  errors,
  expectArraysToEqualIgnoringOrder,
  expectArraysToMatch,
  expectHttpResponseToEqual,
  expectToEqual,
  type SearchRoutes,
  searchImmersionRoutes,
  UserBuilder,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
} from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("Contact establishment public v2 e2e", () => {
  describe(`${searchImmersionRoutes.contactEstablishment.method} ${searchImmersionRoutes.contactEstablishment.url} route`, () => {
    const siret = "11112222333344";

    const establishment = new EstablishmentEntityBuilder()
      .withContactMode("EMAIL")
      .withSiret(siret)
      .build();

    const user = new UserBuilder().build();

    const validRequest: CreateDiscussionDto = {
      appellationCode: "19540",
      siret,
      contactMode: "EMAIL",
      kind: "IF",
      potentialBeneficiaryFirstName: "billy",
      potentialBeneficiaryLastName: "idol",
      potentialBeneficiaryEmail: "potential_beneficiary@email.fr",
      datePreferences: "fake date preferences",
      immersionDuration: "medium",
      motivation: "je suis très motivé pour cette immersion",
      experienceAdditionalInformation: "experienceAdditionalInformation",
      immersionObjective: "Confirmer un projet professionnel",
      potentialBeneficiaryPhone: "+33654783402",
      locationId: establishment.locations[0].id,
    };

    let gateways: InMemoryGateways;
    let eventCrawler: BasicEventCrawler;
    let inMemoryUow: InMemoryUnitOfWork;
    let sharedRequest: HttpClient<SearchRoutes>;

    beforeEach(async () => {
      const testAppAndDeps = await buildTestApp();
      ({ gateways, eventCrawler, inMemoryUow } = testAppAndDeps);
      sharedRequest = createSupertestSharedClient(
        searchImmersionRoutes,
        testAppAndDeps.request,
      );
    });

    it("sends email for valid request and save the discussion", async () => {
      const immersionOffer = new OfferEntityBuilder().build();

      inMemoryUow.romeRepository.appellations = [
        {
          appellationCode: immersionOffer.appellationCode,
          appellationLabel: immersionOffer.appellationLabel,
          romeCode: immersionOffer.romeCode,
          romeLabel: "some label",
        },
      ];

      inMemoryUow.userRepository.users = [user];

      await inMemoryUow.establishmentAggregateRepository.insertEstablishmentAggregate(
        new EstablishmentAggregateBuilder()
          .withEstablishment(establishment)
          .withUserRights([
            {
              role: "establishment-admin",
              status: "ACCEPTED",
              userId: user.id,
              job: "",
              phone: "",
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
            },
          ])
          .withOffers([immersionOffer])
          .build(),
      );

      const result = await sharedRequest.contactEstablishment({
        body: validRequest,
      });

      expectHttpResponseToEqual(result, {
        status: 201,
        body: "",
      });

      const discussions = inMemoryUow.discussionRepository.discussions;

      expect(discussions).toHaveLength(1);
      const discussionId = discussions[0].id;

      expectArraysToMatch(inMemoryUow.outboxRepository.events, [
        {
          topic: "ContactRequestedByBeneficiary",
          payload: {
            siret: validRequest.siret,
            discussionId,
            triggeredBy: null,
          },
        },
      ]);

      await processEventsForEmailToBeSent(eventCrawler);
      const sentEmails = gateways.notification.getSentEmails();

      expect(sentEmails).toHaveLength(2);
      expectArraysToEqualIgnoringOrder(
        sentEmails.map((email) => email.kind),
        ["CONTACT_BY_EMAIL_REQUEST", "CONTACT_BY_EMAIL_CANDIDATE_CONFIRMATION"],
      );

      expect(inMemoryUow.discussionRepository.discussions).toHaveLength(1);
    });

    it("fails with 404 for unknown siret", async () => {
      const siret = "40400040000404";
      const response = await sharedRequest.contactEstablishment({
        body: {
          ...validRequest,
          siret: siret,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: `${errors.establishment.notFound({ siret }).message}`,
        },
      });
    });

    it("fails with 400 for invalid requests", async () => {
      const response = await sharedRequest.contactEstablishment({
        body: {
          ...validRequest,
          siret: undefined,
          appellationCode: undefined,
        } as any,
      });
      expectToEqual(response.body, {
        status: 400,
        message:
          "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /contact-establishment",
        issues: [
          "appellationCode : Ce champ est obligatoire",
          "siret : Ce champ est obligatoire",
        ],
      });
    });
  });
});
