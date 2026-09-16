import { ignoreTabs } from "html-templates";
import { errors, expectPromiseToFailWithError, expectToEqual } from "shared";
import type { HttpClient, HttpResponse } from "shared-routes";
import { makeEmailAllowListPredicate } from "../../../../config/bootstrap/appConfig";
import type { BrevoHeaders } from "../../../../utils/apiBrevoUrl";
import { BrevoNotificationGateway } from "./BrevoNotificationGateway";
import type { BrevoNotificationGatewayRoutes } from "./BrevoNotificationGateway.routes";
import type {
  SendTransactEmailRequestBody,
  SendTransactEmailResponseBody,
} from "./BrevoNotificationGateway.schemas";

const sender = { name: "bob", email: "Machin@mail.com" };

describe("BrevoNotificationGateway unit", () => {
  describe("sendEmail with skipEmailAllowList false", () => {
    let fakeHttpClient: HttpClient<BrevoNotificationGatewayRoutes>;
    let allowListPredicate: (email: string) => boolean;
    let notificationGateway: BrevoNotificationGateway;
    let sentEmails: {
      headers: BrevoHeaders;
      body: SendTransactEmailRequestBody;
    }[];

    beforeEach(() => {
      sentEmails = [];

      fakeHttpClient = {
        sendTransactEmail(
          email: any,
        ): HttpResponse<201, SendTransactEmailResponseBody> {
          sentEmails.push(email);
          return {
            status: 201,
            body: { messageIds: ["some-id"] },
            headers: {},
          };
        },
      } as unknown as HttpClient<BrevoNotificationGatewayRoutes>;

      allowListPredicate = makeEmailAllowListPredicate({
        emailAllowList: [
          "beneficiary@gmail.com",
          "advisor@gmail.com",
          "establishment-ceo@gmail.com",
          "establishment-cto@gmail.com",
        ],
        skipEmailAllowList: false,
      });

      notificationGateway = new BrevoNotificationGateway(
        {
          httpClient: fakeHttpClient,
          defaultSender: sender,
          emailAllowListPredicate: allowListPredicate,
          generateHtmlOptions: { skipHead: true },
        },
        "fake-api-key",
      );
    });

    it("should throw if no recipient is provided", async () => {
      const triggerSendEmail = () =>
        notificationGateway.sendEmail({
          kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
          recipients: [],
          params: {
            scheduleText: "",
          } as any,
        });

      await expectPromiseToFailWithError(
        triggerSendEmail(),
        errors.notification.missingRecipient({ notificationId: undefined }),
      );
    });

    it("should not send email if recipient are not in white list", async () => {
      await notificationGateway.sendEmail({
        kind: "TEST_EMAIL",
        recipients: ["i-am-not-allowed@mail.net"],
        params: {
          scheduleText: "",
        } as any,
      });

      expect(sentEmails).toHaveLength(0);
    });

    it("should filter emails according to predicate", async () => {
      await notificationGateway.sendEmail({
        kind: "TEST_EMAIL",
        recipients: [
          "beneficiary@gmail.com",
          "advisor@gmail.com",
          "i-am-not-allowed@mail.net",
        ],
        params: {
          scheduleText: "",
        } as any,
      });

      expect(sentEmails[0].body.to).toEqual([
        { email: "beneficiary@gmail.com" },
        { email: "advisor@gmail.com" },
      ]);
    });

    it("should filter email and carbon copy according to predicate", async () => {
      const carbonCopy = [
        "establishment-cto@gmail.com",
        "establishment-comptable-not-allowed@gmail.com",
      ];

      await notificationGateway.sendEmail({
        kind: "AGENCY_WAS_ACTIVATED",
        recipients: ["establishment-ceo@gmail.com"],
        cc: carbonCopy,
        params: {
          agencyName: "AGENCY_NAME",
          agencyLogoUrl: "https://beta.gouv.fr/img/logo_twitter_image-2019.jpg",
          refersToOtherAgency: false,
          agencyReferdToName: undefined,
          agencyDashboardUrl:
            "https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence/dashboard",
        },
      });

      expectToEqual(sentEmails[0], {
        headers: {
          "api-key": "fake-api-key",
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: {
          cc: [
            {
              email: "establishment-cto@gmail.com",
            },
          ],
          to: [
            {
              email: "establishment-ceo@gmail.com",
            },
          ],
          tags: [
            "template:agenceActivee",
            "theme:espacePrescripteur",
            "acteur:prescripteur",
            "role:preValideur",
            "role:valideur",
          ],
          subject: "Immersion Facilitée - Votre structure a été activée",
          htmlContent: ignoreTabs(`
      <html lang="fr">
      <body>
      <table 
      width="600" align="center" style="margin-top: 20px">
      <tr>
      <td>
      <table 
      width="600">
      <tr>
      <td 
      width="35%">
      <a 
      href="https://immersion-facile.beta.gouv.fr/">
      <img 
      src="https://immersion.cellar-c2.services.clever-cloud.com/logo-if-mailing.png" 
      width="223" height="108" 
      alt="Immersion Facilitée - République Française"/>
      </a>
      </td>
      <td 
      width="60%" align="right">
      <img 
      src="https://beta.gouv.fr/img/logo_twitter_image-2019.jpg" 
      alt="" style="max-width: 150px; max-height: 120px; height: auto; margin-left: 20px;"/>
      </td>
      </tr>
      <tr>
      <td 
      width="600" height="10" colspan="2"></td>
      </tr>
      <tr>
      <td 
      width="600" height="1" style="background-color:#DDDDDD" colspan="2"></td>
      </tr>
      <tr>
      <td 
      width="600" height="30" colspan="2"></td>
      </tr>
      </table>
      </td>
      </tr>
      <tr>
      <td>
      <p>Bonjour,</p>
      </td>
      </tr>
      <tr>
      <td>
      <table 
      width="600">
      <tr>
      <td>
      <p><strong>Votre organisme prescripteur AGENCY_NAME est activée sur Immersion facilitée !</strong> 
      <br/>
      <br/>Vous pouvez dès à présent valider les conventions dématérialisées sur Immersion Facilitée.
      <br/>
      <br/>false</p>
      </td>
      </tr>
      </table>
      </td>
      </tr>
      <tr>
      <td>
      <table>
      <tr>
      <td 
      align="center" 
      width="600"
      style="padding: 20px; padding-top: 10px; padding-bottom: 30px;"
      >
      <a
      style="text-decoration: none; display: inline-block; padding: 10px 20px; text-align: center; background-color: #000091; color: #fff;"
      href="https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence/dashboard"
      target="_blank"
      >
      Accèder à mon espace
      </a>
      </td>
      </tr>
      </table>
      </td>
      </tr>
      <tr>
      <td>
      <table 
      width="600">
      <tr>
      <td>
      <p><strong>Maîtrisez rapidement l’utilisation du site en 2 temps :</strong>
      <br/>
      <br/>• <strong>Pour les responsables de votre structure</strong> :
      <br/><a 
      href="https://aide.immersion-facile.beta.gouv.fr/fr/article/administrateur-gerer-votre-organisme-sbjao/" 
      target="_blank">Un article d'aide pour paramétrer votre compte</a>
      <br/>(une vidéo est disponible à la fin de l'article, mettez le son)
      <br/>
      <br/>• <strong>Pour l'ensemble de vos collaborateurs</strong> :
      <br/><a 
      href="https://app.livestorm.co/immersion-facilitee/prescripteurs-et-structures-daccompagnement-decouvrir-immersion-facilitee" 
      target="_blank">Un temps de présentation de toutes les fonctionnalités du site</a>
      <br/>(30 minutes de présentation et 30 minutes pour poser les questions)
      <br/>
      <br/>N'hésitez pas à leur partager ce lien :
      <br/><a 
      href="https://app.livestorm.co/immersion-facilitee/prescripteurs-et-structures-daccompagnement-decouvrir-immersion-facilitee" 
      target="_blank">https://app.livestorm.co/immersion-facilitee/prescripteurs-et-structures-daccompagnement-decouvrir-immersion-facilitee</a>
      <br/>
      <br/>Si aucune date ne vous convient, inscrivez-vous et nous vous enverrons le replay.
      <br/>
      <br/>Pour toute question n'hésitez pas à nous contacter via le
      <br/><a 
      href=https://aide.immersion-facile.beta.gouv.fr/fr 
      target="_blank">
      <br/>support d’Immersion Facilitée
      <br/></a>.
      <br/>
      <br/>
      <br/>Bonne journée,
      <br/>L'équipe Immersion Facilitée</p>
      </td>
      </tr>
      </table>
      </td>
      </tr>
      <tr>
      <td>
      <table>
      <tr>
      <td height="30"></td>
      </tr>
      <tr>
      <td 
      width="600" style="background-color: #F5F5FE; text-align: center; padding: 20px 50px; ">
      <p style="font-size: 14px;">Vous recevez cet email, car cette adresse email a été renseignée sur le site Immersion Facilitée dans une demande de convention ou de connexion. Si vous rencontrez un problème, la plupart des solutions sont disponibles sur notre <a 
      href="https://immersion-facile.beta.gouv.fr/aide/">centre d'aide</a>. Vous y trouverez également un formulaire de contact pour joindre notre équipe support, qui vous répondra sous les meilleurs délais.</p>
      </td>
      </tr>
      <tr>
      <td align="center" style="padding: 20px;">
      <img 
      src="https://immersion.cellar-c2.services.clever-cloud.com/email_footer.png" 
      alt=""/>
      </td>
      </tr>
      </table>
      </td>
      </tr>
      </table>
      </body>
      </html>
      `),
          sender,
          attachment: [
            {
              url: "https://immersion.cellar-c2.services.clever-cloud.com/Fiche memo prescripteur-Role-des-prescripteurs-et-couverture-des risques-immersionfacilitee2024.pdf",
            },
          ],
        },
      });
    });
  });

  describe("sendEmail with skipEmailAllowList true", () => {
    let fakeHttpClient: HttpClient<BrevoNotificationGatewayRoutes>;
    let allowListPredicate: (email: string) => boolean;
    let notificationGateway: BrevoNotificationGateway;
    let sentEmails: {
      headers: BrevoHeaders;
      body: SendTransactEmailRequestBody;
    }[];

    beforeEach(() => {
      sentEmails = [];

      fakeHttpClient = {
        sendTransactEmail(
          email: any,
        ): HttpResponse<201, SendTransactEmailResponseBody> {
          sentEmails.push(email);
          return {
            status: 201,
            body: { messageId: "some-id" },
            headers: {},
          };
        },
      } as unknown as HttpClient<BrevoNotificationGatewayRoutes>;

      allowListPredicate = makeEmailAllowListPredicate({
        emailAllowList: [],
        skipEmailAllowList: true,
      });

      notificationGateway = new BrevoNotificationGateway(
        {
          httpClient: fakeHttpClient,
          defaultSender: sender,
          emailAllowListPredicate: allowListPredicate,
          generateHtmlOptions: { skipHead: true },
        },
        "fake-api-key",
      );
    });

    it("should send emails", async () => {
      await notificationGateway.sendEmail({
        kind: "AGENCY_WAS_ACTIVATED",
        recipients: ["toto-test@mail.fr", "jean-louis@hotmail.fr"],
        cc: ["cc@live.fr"],
        params: {
          agencyName: "AGENCY_NAME",
          agencyLogoUrl: "https://beta.gouv.fr/img/logo_twitter_image-2019.jpg",
          refersToOtherAgency: false,
          agencyReferdToName: undefined,
          agencyDashboardUrl:
            "https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence/dashboard",
        },
      });

      expect(sentEmails[0]?.body.to[0].email).toBe("toto-test@mail.fr");
      expect(sentEmails[0]?.body.to[1].email).toBe("jean-louis@hotmail.fr");
      expect(sentEmails[0]?.body.cc?.[0].email).toBe("cc@live.fr");
    });
  });
});
