import { createHmac } from "node:crypto";
import {
  type AbsoluteUrl,
  type BrevoInboundBody,
  DiscussionBuilder,
  type DiscussionId,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  expectObjectsToMatch,
  expectToEqual,
  type FeatureFlags,
  makeBooleanFeatureFlag,
  makeHighlightFeatureFlag,
  makeTextImageAndRedirectFeatureFlag,
  makeTextWithSeverityFeatureFlag,
  type ShortLinkId,
  type TechnicalRoutes,
  technicalRoutes,
  type ValidateEmailFeedback,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { GenerateConventionJwt } from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";

describe("technical router", () => {
  const discussionId = "11111111-1111-4111-9111-111111111111";
  const domain = "immersion-facile.beta.gouv.fr";
  const tallySecret = "tally-secret";

  const npsTallyBody = {
    eventType: "FORM_SUBMISSION",
    createdAt: "2023-06-28T08:06:52.000Z",
    eventId: "tally-event-id",
    data: {
      createdAt: "2023-06-28T08:06:52.000Z",
      formId: "tally-form-id",
      formName: "tally-form-name",
      responseId: "tally-response-id",
      fields: [],
      respondentId: "tally-respondent-id",
      submissionId: "tally-submission-id",
    },
  };

  const delegationContactTallyForm = {
    eventId: "444e93a8-68db-4cc2-ac17-0bbcbd4460f8",
    eventType: "FORM_SUBMISSION",
    createdAt: "2024-04-17T08:56:10.922Z",
    data: {
      responseId: "2O0vAe",
      submissionId: "2O0vAe",
      respondentId: "v2eE1D",
      formId: "w7WM49",
      formName:
        "Recevoir le contact du prescripteur de droit qui peut me délivrer une convention de délégation",
      createdAt: "2024-04-17T08:56:10.000Z",
      fields: [
        {
          key: "question_rDVYj2",
          label: "Nom",
          type: "INPUT_TEXT",
          value: "sdfghjk",
        },
        {
          key: "question_4aLO4A",
          label: "Prénom",
          type: "INPUT_TEXT",
          value: "dfghjk",
        },
        {
          key: "question_jeLzaJ",
          label: "Email",
          type: "INPUT_EMAIL",
          value: "recipient@mail.com",
        },
        {
          key: "question_xV2zXv",
          label:
            "Nom de la structure qui souhaite une convention de délégation",
          type: "INPUT_TEXT",
          value: "kjhg",
        },
        {
          key: "question_VpY1aa",
          label:
            "Région de la structure qui souhaite une convention de délégation",
          type: "MULTIPLE_CHOICE",
          value: ["98052009-6a3a-44c4-87ee-8bc28b5b7161"],
          options: [
            {
              id: "5263bf8d-0eed-4e3a-9e6b-a41d55f6632e",
              text: "Auvergne-Rhône-Alpes",
            },
            {
              id: "98052009-6a3a-44c4-87ee-8bc28b5b7161",
              text: "Bourgogne-Franche-Comté",
            },
          ],
        },
      ],
    },
  };

  let generateConventionJwt: GenerateConventionJwt;
  let httpClient: HttpClient<TechnicalRoutes>;
  let appConfig: AppConfig;
  let inMemoryUow: InMemoryUnitOfWork;
  let gateways: InMemoryGateways;
  let request: SuperTest<Test>;

  beforeEach(async () => {
    ({ request, generateConventionJwt, appConfig, inMemoryUow, gateways } =
      await buildTestApp(
        new AppConfigBuilder({
          INBOUND_EMAIL_ALLOWED_IPS: "130.10.10.10,::ffff:127.0.0.1",
          DOMAIN: domain,
          TALLY_SIGNATURE_SECRET: tallySecret,
        }).build(),
      ));
    httpClient = createSupertestSharedClient(technicalRoutes, request);
  });

  describe("/auth/html-to-pdf", () => {
    it(`${displayRouteName(
      technicalRoutes.htmlToPdf,
    )} 200 - Should get PDF content from html string`, async () => {
      const validatorJwt = generateConventionJwt({
        exp: Date.now() / 1000 + 1000,
        iat: Date.now() / 1000,
        version: 1,
        role: "validator",
        emailHash: "my-hash",
        applicationId: "convention-id",
      });
      const response = await httpClient.htmlToPdf({
        body: {
          htmlContent: "<p>some html content</p>",
          conventionId: "convention-id",
        },
        headers: {
          authorization: validatorJwt,
        },
      });
      expectToEqual(
        response.body,
        'PDF_OF convention convention-id >> "<p>some html content</p>"',
      );

      expectToEqual(response.status, 200);
    });
  });

  describe("/inbound-email-parsing", () => {
    it(`${displayRouteName(
      technicalRoutes.inboundEmailParsing,
    )} 200 - when IP is allowed and body is correct`, async () => {
      inMemoryUow.discussionRepository.discussions = [
        new DiscussionBuilder().withId(discussionId).build(),
      ];

      const response = await httpClient.inboundEmailParsing({
        body: correctBrevoResponse(discussionId, domain),
        headers: { "X-Forwarded-For": appConfig.inboundEmailAllowedIps[0] },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });

    it(`${displayRouteName(
      technicalRoutes.inboundEmailParsing,
    )} 400 - when email has a wrong structure`, async () => {
      const incorrectDiscussionEmail = "john.doe@invalid-email.com";
      const brevoResponseWithInvalidEmail = correctBrevoResponse(
        discussionId,
        domain,
        incorrectDiscussionEmail,
      );
      const response = await httpClient.inboundEmailParsing({
        body: brevoResponseWithInvalidEmail,
        headers: { "X-Forwarded-For": appConfig.inboundEmailAllowedIps[0] },
      });

      expectHttpResponseToEqual(response, {
        body: {
          message: errors.discussion.badEmailFormat({
            email: incorrectDiscussionEmail,
          }).message,
          status: 400,
        },
        status: 400,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.inboundEmailParsing,
    )} 400 - when email has a wrong recipient kind`, async () => {
      const incorrectRecipientEmail =
        "firstname1_lastname1__11111111-1111-4111-1111-111111111111_wrong@reply.immersion-facile.beta.gouv.fr";
      const brevoResponseWithInvalidEmail = correctBrevoResponse(
        discussionId,
        domain,
        incorrectRecipientEmail,
      );
      const response = await httpClient.inboundEmailParsing({
        body: brevoResponseWithInvalidEmail,
        headers: { "X-Forwarded-For": appConfig.inboundEmailAllowedIps[0] },
      });

      expectHttpResponseToEqual(response, {
        body: {
          message: errors.discussion.badRecipientKindFormat({
            kind: "wrong",
          }).message,
          status: 400,
        },
        status: 400,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.inboundEmailParsing,
    )} 400 - when IP is allowed and body is wrong`, async () => {
      const response = await httpClient.inboundEmailParsing({
        body: { yolo: "wrong body" } as any,
        headers: { "X-Forwarded-For": appConfig.inboundEmailAllowedIps[0] },
      });

      expectHttpResponseToEqual(response, {
        body: {
          issues: ["items : Invalid input: expected array, received undefined"],
          message:
            "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /inbound-email-parsing",
          status: 400,
        },
        status: 400,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.inboundEmailParsing,
    )} 403 - when IP is not allowed`, async () => {
      const unallowedIp = "245.10.12.54";
      const response = await httpClient.inboundEmailParsing({
        body: correctBrevoResponse(discussionId, domain),
        headers: { "X-Forwarded-For": unallowedIp },
      });

      expectHttpResponseToEqual(response, {
        body: {},
        status: 403,
      });
    });
  });

  describe("/to/:shortLinkId", () => {
    const expectedShortLinkId: ShortLinkId = "shortLinkId";

    it(`${displayRouteName(
      technicalRoutes.shortLink,
    )} 302 - Redirect on existing short link`, async () => {
      const expectedLongLink: AbsoluteUrl = "http://longLink";
      inMemoryUow.shortLinkQuery.setShortLinks([
        {
          id: expectedShortLinkId,
          url: expectedLongLink,
          lastUsedAt: null,
        },
      ]);

      const response = await httpClient.shortLink({
        urlParams: { shortLinkId: expectedShortLinkId },
      });

      expectHttpResponseToEqual(response, {
        body: {},
        status: 302,
        headers: { location: expectedLongLink },
      });
    });

    it(`${displayRouteName(
      technicalRoutes.shortLink,
    )} 404 - Not found on missing short link`, async () => {
      const response = await httpClient.shortLink({
        urlParams: { shortLinkId: expectedShortLinkId },
      });

      expect(response.status).toBe(404);
      expectObjectsToMatch(response.body, {
        message: errors.shortLink.notFound({ shortLinkId: expectedShortLinkId })
          .message,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.shortLink,
    )} 302 - Redirect to long URL and short link last used updated`, async () => {
      const expectedLongLink: AbsoluteUrl = "https://example.com/sign?jwt=abc";

      inMemoryUow.shortLinkQuery.setShortLinks([
        {
          id: expectedShortLinkId,
          url: expectedLongLink,
          lastUsedAt: null,
        },
      ]);

      expectHttpResponseToEqual(
        await httpClient.shortLink({
          urlParams: { shortLinkId: expectedShortLinkId },
        }),
        {
          body: {},
          status: 302,
          headers: { location: expectedLongLink },
        },
      );

      expectToEqual(inMemoryUow.shortLinkQuery.getShortLinks(), [
        {
          id: expectedShortLinkId,
          url: expectedLongLink,
          lastUsedAt: gateways.timeGateway.now(),
        },
      ]);
    });
  });

  describe("/validate-email", () => {
    const candidateEmail = "enguerran.weiss@beta.gouv.fr";
    const expectedStatus: ValidateEmailFeedback = {
      status: "accepted_email",
      proposal: null,
    };

    it(`${displayRouteName(
      technicalRoutes.validateEmail,
    )} 200 with '?email=enguerran.weiss@beta.gouv.fr'`, async () => {
      gateways.emailValidationGateway.setEmailValidationStatusResponse(
        expectedStatus,
      );
      const response = await httpClient.validateEmail({
        queryParams: { email: candidateEmail },
      });
      expectHttpResponseToEqual(response, {
        body: expectedStatus,
        status: 200,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.validateEmail,
    )} 400 with '?email="invalid-email"`, async () => {
      const invalidEmail = "invalid-email";
      const response = await httpClient.validateEmail({
        queryParams: {
          email: invalidEmail,
        },
      });
      expectHttpResponseToEqual(response, {
        body: {
          issues: [
            "email : Veuillez saisir une adresse e-mail valide - email fourni : 'invalid-email'",
          ],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /validate-email",
          status: 400,
        },
        status: 400,
      });
    });
  });

  describe("/feature-flags", () => {
    const defaultFeatureFlags: FeatureFlags = {
      enableTemporaryOperation: makeTextImageAndRedirectFeatureFlag(false, {
        imageAlt: "altImage",
        imageUrl: "https://imageUrl",
        message: "message",
        redirectUrl: "https://redirect-url",
        overtitle: "overtitle",
        title: "title",
      }),
      enableMaintenance: makeTextWithSeverityFeatureFlag(false, {
        message: "Maintenance message",
        severity: "warning",
      }),
      enableSearchByScore: makeBooleanFeatureFlag(false),
      enableBroadcastOfConseilDepartementalToFT: makeBooleanFeatureFlag(false),
      enableBroadcastOfCapEmploiToFT: makeBooleanFeatureFlag(false),
      enableBroadcastOfMissionLocaleToFT: makeBooleanFeatureFlag(false),
      enableEstablishmentDashboardHighlight: makeHighlightFeatureFlag(false, {
        title: "Mon titre de highlight pour l'entreprise",
        message: "Mon message de highlight pour l'entreprise",
        href: "https://www.example.com",
        label: "Mon label de highlight pour l'entreprise",
      }),
      enableAgencyDashboardHighlight: makeHighlightFeatureFlag(false, {
        title: "Mon titre de highlight pour l'agence",
        message: "Mon message de highlight pour l'agence",
        href: "https://www.example.com",
        label: "Mon label de highlight pour l'agence",
      }),
      enableInactiveUsersCleanup: makeBooleanFeatureFlag(false),
      enableInactiveUsersDeletionAutoProcessing: makeBooleanFeatureFlag(false),
      enableRequestArchivedConvention: makeBooleanFeatureFlag(false),
      enableBeneficiaryManageConvention: makeBooleanFeatureFlag(false),
    };
    it(`${displayRouteName(
      technicalRoutes.featureFlags,
    )} 200 when all goes well without query params`, async () => {
      const response = await httpClient.featureFlags({
        queryParams: null,
      });
      expectHttpResponseToEqual(response, {
        body: defaultFeatureFlags,
        status: 200,
      });
    });
    it(`${displayRouteName(
      technicalRoutes.featureFlags,
    )} 200 when all goes well with query params`, async () => {
      const response = await httpClient.featureFlags({
        queryParams: { [Date.now().toString()]: "" },
      });
      expectHttpResponseToEqual(response, {
        body: defaultFeatureFlags,
        status: 200,
      });
    });
    it(`${displayRouteName(
      technicalRoutes.featureFlags,
    )} 400 when query params are invalid`, async () => {
      const response = await httpClient.featureFlags({
        queryParams: { "invalid-timestamp": "" },
      });
      expectHttpResponseToEqual(response, {
        body: {
          issues: [
            "invalid-timestamp : Invalid key in record",
            " : Invalid input: expected null, received object",
          ],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /feature-flags",
          status: 400,
        },
        status: 400,
      });
    });
  });

  describe("NPS route for tally webhook", () => {
    it(`${displayRouteName(
      technicalRoutes.npsValidatedConvention,
    )} 201 when all goes well`, async () => {
      const bodySignature = createHmac("sha256", tallySecret)
        .update(JSON.stringify(npsTallyBody))
        .digest("base64");

      const response = await httpClient.npsValidatedConvention({
        headers: { "tally-signature": bodySignature },
        body: npsTallyBody,
      });
      expectHttpResponseToEqual(response, {
        body: "",
        status: 201,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.npsValidatedConvention,
    )}  403 when signature does not match`, async () => {
      const response = await httpClient.npsValidatedConvention({
        headers: { "tally-signature": "wrong-signature" },
        body: npsTallyBody,
      });

      expectHttpResponseToEqual(response, {
        body: {
          message: "Missmatch Tally signature",
          status: 403,
        },
        status: 403,
      });
    });
  });

  describe("DelegationContactRequest for Tally webhook", () => {
    it(`${displayRouteName(
      technicalRoutes.delegationContactRequest,
    )} 201 when all goes well`, async () => {
      const bodySignature = createHmac("sha256", tallySecret)
        .update(JSON.stringify(delegationContactTallyForm))
        .digest("base64");
      inMemoryUow.delegationContactRepository.delegationContacts = [
        {
          province: "Bourgogne-Franche-Comté",
          email: "delegation-contact@mail.fr",
        },
      ];

      const response = await httpClient.delegationContactRequest({
        headers: { "tally-signature": bodySignature },
        body: delegationContactTallyForm,
      });
      expectHttpResponseToEqual(response, {
        body: "",
        status: 201,
      });
    });

    it(`${displayRouteName(
      technicalRoutes.delegationContactRequest,
    )}  403 when signature does not match`, async () => {
      const response = await httpClient.delegationContactRequest({
        headers: { "tally-signature": "wrong-signature" },
        body: delegationContactTallyForm,
      });

      expectHttpResponseToEqual(response, {
        body: {
          message: "Missmatch Tally signature",
          status: 403,
        },
        status: 403,
      });
    });
  });
});

const correctBrevoResponse = (
  discussionId: DiscussionId,
  domain: string,
  recipientEmail?: string,
): BrevoInboundBody => ({
  items: [
    {
      Uuid: ["8d79f2b1-20ae-4939-8d0b-d2517331a9e5"],
      MessageId:
        "<CADYedJsX7_KwtMJem4m-Dhwqp5fmBiqrdMzzDBu-7nbfAuY=ew@mail.gmail.com>",
      InReplyTo:
        "<CADYedJsS=ZXd8RPDjNuD7GhOwCgvaLwvAS=2kU3N+sd5wgu6Ag@mail.gmail.com>",
      From: {
        Name: "Enguerran Weiss",
        Address: "enguerranweiss@gmail.com",
      },
      To: [
        {
          Name: null,
          Address:
            recipientEmail ??
            `firstname1_lastname1__${discussionId}_b@reply.${domain}`,
        },
      ],
      Cc: [
        {
          Name: null,
          Address: "gerard2@reply-dev.immersion-facile.beta.gouv.fr",
        },
        {
          Name: null,
          Address: "gerard-cc@reply-dev.imersion-facile.beta.gouv.fr",
        },
      ],
      ReplyTo: null,
      SentAtDate: "Wed, 28 Jun 2023 10:06:52 +0200",
      Subject: "Fwd: Hey !",
      Attachments: [
        {
          Name: "IMG_20230617_151239.jpg",
          ContentType: "image/jpeg",
          ContentLength: 1652571,
          DownloadToken:
            "eyJmb2xkZXIiOiIyMDIzMDYyODA4MDcwNy41Ni4xNTQxNDI5NTQwIiwiZmlsZW5hbWUiOiJJTUdfMjAyMzA2MTdfMTUxMjM5LmpwZyJ9",
        },
      ],

      RawHtmlBody:
        '<div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:57<br>Subject: Fwd: Hey !<br>To: &lt;<a href="mailto:tristan@reply-dev.immersion-facile.beta.gouv.fr">tristan@reply-dev.immersion-facile.beta.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com" target="_blank">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:55<br>Subject: Hey !<br>To: &lt;<a href="mailto:roger@reply-dev.immersion-facile.gouv.fr" target="_blank">roger@reply-dev.immersion-facile.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><div><br clear="all"></div><div>Comment ça va ?</div><div><br></div><div><img src="cid:ii_ljff7lfo0" alt="IMG_20230617_151239.jpg" style="margin-right:0px" width="223" height="167"></div><div><br></div><div><br></div><div>A + !<br></div><div><br></div><div><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div></div>\r\n</div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div>\r\n</div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div>\r\n',
      RawTextBody:
        "---------- Forwarded message ---------\r\nDe : Enguerran Weiss <enguerranweiss@gmail.com>\r\nDate: mer. 28 juin 2023 à 09:57\r\nSubject: Fwd: Hey !\r\nTo: <tristan@reply-dev.immersion-facile.beta.gouv.fr>\r\n\n\n\n\n---------- Forwarded message ---------\r\nDe : Enguerran Weiss <enguerranweiss@gmail.com>\r\nDate: mer. 28 juin 2023 à 09:55\r\nSubject: Hey !\r\nTo: <roger@reply-dev.immersion-facile.gouv.fr>\r\n\n\n\nComment ça va ?\r\n\n[image: IMG_20230617_151239.jpg]\r\n\n\nA + !\r\n\n-- \r\n\n+33(0)6 10 13 76 84\r\nhello@enguerranweiss.fr\r\nhttp://www.enguerranweiss.fr\r\n\n\n-- \r\n\n+33(0)6 10 13 76 84\r\nhello@enguerranweiss.fr\r\nhttp://www.enguerranweiss.fr\r\n\n\n-- \r\n\n+33(0)6 10 13 76 84\r\nhello@enguerranweiss.fr\r\nhttp://www.enguerranweiss.fr\r\n",
    },
  ],
});
