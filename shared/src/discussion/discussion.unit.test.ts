import { subDays } from "date-fns";
import { omit } from "ramda";
import { expectToEqual } from "../test.helpers";
import { DiscussionBuilder } from "./DiscussionBuilder";
import type {
  DiscussionDisplayStatus,
  DiscussionFollowUp,
  DiscussionReadDto,
  Exchange,
  SpecificExchangeSender,
} from "./discussion.dto";
import {
  getDiscussionDisplayStatus,
  getDiscussionFollowUp,
} from "./discussion.helpers";
import {
  discussionReadSchema,
  discussionSchema,
  makeExchangeEmailSchema,
} from "./discussion.schema";

describe("Discussions", () => {
  describe("getDiscussionDisplayStatus & getDiscussionFollowUp", () => {
    type TestCase = {
      message: string;
      discussion: DiscussionReadDto;
      viewer: SpecificExchangeSender<
        "establishment" | "potentialBeneficiary"
      >["sender"];
      expectedDisplayStatus: DiscussionDisplayStatus;
      expectedFollowUp?: DiscussionFollowUp;
      hasEstablishmentAnswered: boolean;
      isEstablishmentReachableByPhoneAfter15Days: boolean;
    };

    const createExchange = ({
      sentAt,
      specificExchangeSender,
    }: {
      sentAt: Date;
      specificExchangeSender: SpecificExchangeSender<
        "establishment" | "potentialBeneficiary"
      >;
    }): Exchange => ({
      subject: "Some subject",
      message: "Some message",
      attachments: [],
      sentAt: sentAt.toISOString(),
      ...specificExchangeSender,
    });

    const now = new Date("2025-05-12");

    const testCases: TestCase[] = [
      {
        message: "status is REJECTED",
        viewer: "establishment",
        expectedDisplayStatus: "rejected",
        discussion: new DiscussionBuilder()
          .withStatus({
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          })
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message: "status is ACCEPTED",
        viewer: "establishment",
        expectedDisplayStatus: "accepted",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "ACCEPTED", candidateWarnedMethod: null })
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message: "candidate has sent the first message without being answered",
        viewer: "establishment",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 1),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message: "candidate has sent multiple messages without being answered",
        viewer: "establishment",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 3),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 2),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 1),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "candidate has sent the first message without being answered since 15 days",
        viewer: "establishment",
        expectedDisplayStatus: "new",
        expectedFollowUp: "needs-answer",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "candidate has sent the first message without being answered since 14 days",
        viewer: "potentialBeneficiary",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 14),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "candidate has sent the last message without being answered (but it is not the first message)",
        viewer: "establishment",
        expectedDisplayStatus: "pending",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 3),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 2),
              specificExchangeSender: {
                sender: "establishment",
                email: "establishment@mail.com",
                firstname: "billy",
                lastname: "idol",
              },
            }),
            createExchange({
              sentAt: subDays(now, 1),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: true,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message: "last message is sent by establishment",
        viewer: "establishment",
        expectedDisplayStatus: "pending",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 2),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 1),
              specificExchangeSender: {
                sender: "establishment",
                email: "establishment@mail.com",
                firstname: "billy",
                lastname: "idol",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: true,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "last message is from establishment and has had no answer for more than 15 days",
        viewer: "potentialBeneficiary",
        expectedFollowUp: "needs-answer",
        expectedDisplayStatus: "pending",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 16),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "establishment",
                email: "establishment@mail.com",
                firstname: "billy",
                lastname: "idol",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: true,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "last message is from beneficiary and has had no answer for more than 15 days",
        viewer: "establishment",
        expectedFollowUp: "needs-answer",
        expectedDisplayStatus: "pending",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 17),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 16),
              specificExchangeSender: {
                sender: "establishment",
                email: "establishment@mail.com",
                firstname: "billy",
                lastname: "idol",
              },
            }),
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: true,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message: "discussion is recent and contact method not email",
        viewer: "establishment",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withCreatedAt(subDays(now, 14))
          .withStatus({ status: "PENDING" })
          .withContactMode("PHONE")
          .withExchanges([])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "discussion is older than 15 days and contact method not email",
        viewer: "establishment",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withCreatedAt(subDays(now, 15))
          .withStatus({ status: "PENDING" })
          .withContactMode("PHONE")
          .withExchanges([])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "discussion is older than 15 days and establishment has not answered for long time (and is reachable by phone)",
        viewer: "potentialBeneficiary",
        expectedDisplayStatus: "new",
        expectedFollowUp: "to-remind",
        discussion: new DiscussionBuilder()
          .withCreatedAt(subDays(now, 15))
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: true,
      },
      {
        message:
          "discussion is older than 15 days and establishment has not answered for long time (and is not reachable by phone)",
        viewer: "potentialBeneficiary",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withCreatedAt(subDays(now, 15))
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
      {
        message:
          "discussion is older than 15 days and establishment has not answered for long time (and is reachable by phone)",
        viewer: "potentialBeneficiary",
        expectedDisplayStatus: "new",
        expectedFollowUp: "to-remind",
        discussion: new DiscussionBuilder()
          .withCreatedAt(subDays(now, 15))
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: true,
      },
      {
        message:
          "candidate has sent multiple messages without being answered for long time (and is not reachable by phone)",
        viewer: "potentialBeneficiary",
        expectedDisplayStatus: "new",
        discussion: new DiscussionBuilder()
          .withStatus({ status: "PENDING" })
          .withExchanges([
            createExchange({
              sentAt: subDays(now, 17),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 16),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
            createExchange({
              sentAt: subDays(now, 15),
              specificExchangeSender: {
                sender: "potentialBeneficiary",
              },
            }),
          ])
          .buildRead(),
        hasEstablishmentAnswered: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
      },
    ];

    it.each(testCases)(
      "returns $expectedDisplayStatus when $message",
      ({
        discussion,
        expectedDisplayStatus,
        expectedFollowUp,
        viewer,
        hasEstablishmentAnswered,
        isEstablishmentReachableByPhoneAfter15Days,
      }) => {
        expectToEqual(
          getDiscussionDisplayStatus({
            discussion: {
              createdAt: discussion.createdAt,
              status: discussion.status,
              exchangesData: {
                count: discussion.exchanges.length,
                hasEstablishmentAnswered,
                lastExchange:
                  discussion.exchanges[discussion.exchanges.length - 1],
              },
            },
          }),
          expectedDisplayStatus,
        );
        expectToEqual(
          getDiscussionFollowUp({
            discussion: {
              createdAt: discussion.createdAt,
              status: discussion.status,
              exchangesData: {
                count: discussion.exchanges.length,
                hasEstablishmentAnswered,
                lastExchange:
                  discussion.exchanges[discussion.exchanges.length - 1],
              },
            },
            now,
            viewer,
            isEstablishmentReachableByPhoneAfter15Days,
          }),
          expectedFollowUp,
        );
      },
    );
  });

  describe("Discussion schema", () => {
    const discussionEmailIF = new DiscussionBuilder()
      .withContactMode("EMAIL")
      .withDiscussionKind("IF")
      .build();

    const discussionEmail1E1S = new DiscussionBuilder()
      .withContactMode("EMAIL")
      .withDiscussionKind("1_ELEVE_1_STAGE")
      .build();

    const discussionPhoneIF = new DiscussionBuilder()
      .withContactMode("PHONE")
      .withDiscussionKind("IF")
      .build();

    const discussionPhone1E1S = new DiscussionBuilder()
      .withContactMode("PHONE")
      .withDiscussionKind("1_ELEVE_1_STAGE")
      .build();

    const discussionInPersonIF = new DiscussionBuilder()
      .withContactMode("IN_PERSON")
      .withDiscussionKind("IF")
      .build();

    const discussionInPerson1E1S = new DiscussionBuilder()
      .withContactMode("IN_PERSON")
      .withDiscussionKind("1_ELEVE_1_STAGE")
      .build();

    it.each([
      discussionEmailIF,
      discussionEmail1E1S,
      discussionInPerson1E1S,
      discussionInPersonIF,
      discussionPhone1E1S,
      discussionPhoneIF,
    ])("Test discussionSchema", (discussion) => {
      expectToEqual(discussionSchema.parse(discussion), discussion);
    });

    it("discussionSchema keeps the establishment exchange email (unlike the read schema)", () => {
      const discussion = new DiscussionBuilder()
        .withExchanges([
          {
            subject: "Sujet",
            message: "message",
            sender: "establishment",
            firstname: "John",
            lastname: "Doe",
            email: "john.doe@establishment.com",
            sentAt: new Date("2024-01-01").toISOString(),
            attachments: [],
          },
        ])
        .build();

      expectToEqual(discussionSchema.parse(discussion), discussion);
    });

    it("discussionSchema rejects an IF discussion without motivation", () => {
      if (discussionEmailIF.kind !== "IF")
        throw new Error("expected an IF discussion for this test");
      expect(() =>
        discussionSchema.parse({
          ...discussionEmailIF,
          potentialBeneficiary: omit(
            ["motivation"],
            discussionEmailIF.potentialBeneficiary,
          ),
        }),
      ).toThrow();
    });

    it.each([
      discussionEmailIF,
      discussionEmail1E1S,
      discussionInPerson1E1S,
      discussionInPersonIF,
      discussionPhone1E1S,
      discussionPhoneIF,
    ])("Test discussionReadSchema", ({ appellationCode, ...rest }) => {
      const discussionRead: DiscussionReadDto = {
        ...rest,
        appellation: {
          appellationCode: appellationCode,
          appellationLabel: "osef",
          romeCode: "A2023",
          romeLabel: "osef",
        },
      };

      expectToEqual(discussionReadSchema.parse(discussionRead), discussionRead);
    });

    it.each([
      "motivation",
      "immersionDuration",
      "experienceAdditionalInformation",
    ] as const)(
      "discussionReadSchema rejects an IF discussion without %s",
      (missingField) => {
        const { appellationCode, ...rest } = discussionEmailIF;
        if (rest.kind !== "IF")
          throw new Error("expected an IF discussion for this test");
        const invalidDiscussionRead = {
          ...rest,
          appellation: {
            appellationCode: appellationCode,
            appellationLabel: "osef",
            romeCode: "A2023",
            romeLabel: "osef",
          },
          potentialBeneficiary: omit([missingField], rest.potentialBeneficiary),
        };

        expect(() =>
          discussionReadSchema.parse(invalidDiscussionRead),
        ).toThrow();
      },
    );

    it("accept message with html sanitized - tested input sample of inbound parsing real usage", () => {
      const { appellationCode, ...rest } = new DiscussionBuilder().build();
      const discussionReadWithInboundParsingMessage: DiscussionReadDto = {
        ...rest,
        appellation: {
          appellationCode: appellationCode,
          appellationLabel: "osef",
          romeCode: "A2023",
          romeLabel: "osef",
        },
        exchanges: [
          {
            subject: "aze",
            firstname: "aze",
            lastname: "aze",
            sender: "establishment",
            sentAt: "2026-05-03",
            attachments: [],
            message: `<div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:57<br>Subject: Fwd: Hey !<br>To: &lt;<a href="mailto:tristan@reply-dev.immersion-facile.beta.gouv.fr">tristan@reply-dev.immersion-facile.beta.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com" target="_blank">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:55<br>Subject: Hey !<br>To: &lt;<a href="mailto:roger@reply-dev.immersion-facile.gouv.fr" target="_blank">roger@reply-dev.immersion-facile.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><div><br clear="all"></div><div>Comment ça va ?</div><div><br></div><div><img src="cid:ii_ljff7lfo0" alt="IMG_20230617_151239.jpg" style="margin-right:0px" width="223" height="167"></div><div><br></div><div><br></div><div>A + !<br></div><div><br></div><div><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div></div></div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div></div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div>`,
          },
        ],
      };
      expectToEqual(
        discussionReadSchema.parse(discussionReadWithInboundParsingMessage),
        discussionReadWithInboundParsingMessage,
      );
    });
  });
});

describe("makeExchangeEmailSchema", () => {
  it("should parse the email", () => {
    const email = "firstname_lastname__discussionId_e@reply.domain.com";
    const result = makeExchangeEmailSchema("reply.domain.com").parse(email);
    expectToEqual(result, {
      firstname: "firstname",
      lastname: "lastname",
      discussionId: "discussionId",
      rawRecipientKind: "e",
    });
  });
  it("should parse the email even if recipient kind is not known", () => {
    const email = "firstname_lastname__discussionId_bob@reply.domain.com";
    const result = makeExchangeEmailSchema("reply.domain.com").parse(email);
    expectToEqual(result, {
      firstname: "firstname",
      lastname: "lastname",
      discussionId: "discussionId",
      rawRecipientKind: "bob",
    });
  });

  it("should handle the old email format", () => {
    const email = "discussionId_e@reply.domain.com";
    const result = makeExchangeEmailSchema("reply.domain.com").parse(email);
    expectToEqual(result, {
      discussionId: "discussionId",
      rawRecipientKind: "e",
    });
  });

  it("should throw an error if the email is not valid", () => {
    const email = "john_doe_discussionId_bob@reply.domain.com";
    expect(() =>
      makeExchangeEmailSchema("reply.domain.com").parse(email),
    ).toThrow();
  });
});
