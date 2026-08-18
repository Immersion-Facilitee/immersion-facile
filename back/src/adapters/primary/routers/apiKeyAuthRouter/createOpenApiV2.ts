import {
  ConventionDtoBuilder,
  type CreateWebhookSubscription,
  localization,
  makeEmptyLastReminders,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { createOpenApiGenerator } from "shared-routes/openapi";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ConventionUpdatedSubscriptionCallbackBody } from "../../../../domains/core/api-consumer/ports/SubscribersGateway";
import type { ConventionReadPublicV2Dto } from "../DtoAndSchemas/v2/input/ConventionReadPublicV2.dto";
import { conventionReadPublicV2Schema } from "../DtoAndSchemas/v2/input/ConventionReadPublicV2.schema";

import {
  publicApiV2ConventionRoutes,
  publicApiV2StatisticsRoutes,
  publicApiV2WebhooksRoutes,
} from "./publicApiV2.routes";

const apiKeyAuth = "apiKeyAuth";

const conventionSection = "Accès aux conventions";
const statisticsSection = "Statistiques";
const webhookSection = "Souscriptions aux webhooks";

const generateOpenApi = (envType: string) =>
  createOpenApiGenerator(
    {
      [conventionSection]: publicApiV2ConventionRoutes,
      [statisticsSection]: publicApiV2StatisticsRoutes,
      [webhookSection]: publicApiV2WebhooksRoutes,
    },
    {
      info: {
        title: "Les API Immersion facilitée",
        description: `Une nouvelle version de l'API concernant les entreprises est en cours de développement: <a href="/doc-api?version=v3" id='doc-api-link-from-v2-to-v3'>Consulter la v3</a>.
        Ceci est la documentation pour consommer l’api d’immersion facilitée.
      Une clé API est nécessaire pour utiliser l’api. Veuillez vous mettre en contact avec l’équipe d’immersion facilitée pour l’obtenir.
      Vous aurez à préciser ce dont vous avez besoin :
      <ul>
      <li>la partie recherche d’entreprise</li> 
      <li>la partie accès aux conventions (dans ce cas il nous faudra connaître les agences qui vous concernent)</li>
      </ul>
     La clé API est à fournir en authorization header de toutes les requêtes.
     
      `,
        version: "v2",
      },
      servers: [
        {
          url: "/api",
          description: envType,
        },
      ],
      openapi: "3.1.0",
      security: [{ [apiKeyAuth]: [] }],
      components: {
        securitySchemes: {
          [apiKeyAuth]: {
            type: "apiKey",
            in: "header",
            name: "authorization",
            description:
              "Une clé api est nécessaire pour utiliser l’api. Veuillez contacter immersion facilitée si vous souhaitez l’obtenir.",
          },
        },
      },
    },
  );

const error401Example = {
  status: 401,
  message: "unauthenticated",
};
const error403Example = {
  status: 403,
  message: "unauthorized consumer Id",
};
const error404Example = {
  status: 404,
  message: "No establishment found with siret 12345678912345",
};
const error429Example = {
  status: 429,
  message: "Too many requests, please try again later.",
};

const conventionExample: ConventionReadPublicV2Dto = {
  ...new ConventionDtoBuilder().build(),
  agencyName: "Agence de test",
  agencyDepartment: "75",
  agencyKind: "pole-emploi",
  agencySiret: "11112222000033",
  agencyContactEmail: "contact@mail.com",
  agencyValidationSteps: "validator-only",
  agencyRefersTo: undefined,
  assessment: {
    status: "COMPLETED",
    endedWithAJob: false,
    signedAt: null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  isEstablishmentBanned: false,
  lastReminders: makeEmptyLastReminders(),
};

const callbackBodySchema: ZodSchemaWithInputMatchingOutput<ConventionUpdatedSubscriptionCallbackBody> =
  z.object({
    payload: z.object({ convention: conventionReadPublicV2Schema }),
    subscribedEvent: z.enum(["convention.updated"], {
      error: localization.invalidEnum,
    }),
  });

const callbackBodyExample: ConventionUpdatedSubscriptionCallbackBody = {
  payload: { convention: conventionExample },
  subscribedEvent: "convention.updated",
};

const subscribeToWebhookExample: CreateWebhookSubscription = {
  callbackUrl: "https://my-callback-url.com/conventions-updated",
  subscribedEvent: "convention.updated",
  callbackHeaders: {
    authorization: "my-token",
  },
};

const errorDescriptionsAndSchemas = {
  "400": {
    description: "Erreur dans le contrat d'api'",
  },
  "401": {
    description: "Utilisateur non authentifié",
    example: error401Example,
  },
  "403": {
    description:
      "Accès non autorisé (veuillez vérifier que vous avez les droits)",
    example: error403Example,
  },
  "429": {
    description:
      "Trop d'appels en cours. Veuillez réessayer dans quelques instants",
    example: error429Example,
  },
};

export const createOpenApiSpecV2 = (envType: string) =>
  generateOpenApi(envType)({
    [conventionSection]: {
      getConventionById: {
        summary: "Récupération d'une convention",
        description: "Renvoie la convention correspondante",
        extraDocs: {
          responses: {
            "200": {
              description: "Retourne la convention",
              example: conventionExample,
            },
            "400": {
              description: "Erreur dans le contrat d'api'",
            },
            "401": {
              description: "Utilisateur non authentifié",
              example: error401Example,
            },
            "403": {
              description:
                "Accès non autorisé (veuillez vérifier que vous avez les droits)",
              example: error403Example,
            },
            "404": {
              description: "Convention non trouvé",
              example: error404Example,
            },
            "429": {
              description:
                "Trop d'appels en cours. Veuillez réessayer dans quelques instants",
              example: error429Example,
            },
          },
        },
      },
      getConventions: {
        summary:
          "Récupération de conventions filtrées sur le scope du consommateur de l'api",
        description: `Renvoie les conventions correspondantes.
        Les résultats sont limités à 100 et triés par date décroissante de début d'immersion`,
        extraDocs: {
          queryParams: {
            startDateGreater: { example: "2021-10-01" as any },
            startDateLessOrEqual: { example: "2021-10-01" as any },
          },
          responses: {
            "200": {
              description: "Retourne un tableau de conventions",
              example: [conventionExample],
            },
            "400": {
              description: "Erreur dans le contrat d'api'",
            },
            "401": {
              description: "Utilisateur non authentifié",
              example: error401Example,
            },
            "403": {
              description:
                "Accès non autorisé (veuillez vérifier que vous avez les droits)",
              example: error403Example,
            },
            "429": {
              description:
                "Trop d'appels en cours. Veuillez réessayer dans quelques instants",
              example: error429Example,
            },
          },
        },
      },
    },
    [statisticsSection]: {
      getEstablishmentStats: {
        summary: "Récupérer les statistiques d'entreprises",
        description:
          "Permets de récupérer des statistiques sur les entreprises, le nombre de conventions, si elles sont référencées chez Immersion Facilitée, etc...",
        extraDocs: {
          queryParams: {
            page: {
              description: "Le numéro de page",
              example: 1,
            },
            perPage: {
              description: "Le nombre de résultats par page",
              example: 50,
            },
          },
          responses: {
            "200": {
              description:
                "Retourne une liste paginée de valeurs par entreprise.",
              example: {
                data: [
                  {
                    siret: "11110000111100",
                    name: "Entreprise 1",
                    numberOfConventions: 4,
                    isReferenced: true,
                    referencedAt: new Date("2025-11-04").toISOString(),
                  },
                  {
                    siret: "22220000222200",
                    name: "Entreprise 2",
                    numberOfConventions: 1,
                    isReferenced: false,
                    referencedAt: null,
                  },
                ],
                pagination: {
                  totalRecords: 2,
                  totalPages: 1,
                  numberPerPage: 50,
                  currentPage: 1,
                },
              },
            },
            ...errorDescriptionsAndSchemas,
            "400": {
              description: "Erreur dans le contrat d'api'",
              example: {
                status: 400,
                message:
                  "Page number is more than the total number of pages (required page: 2000 > total pages: 10, with 50 results / page)",
              },
            },
          },
        },
      },
    },
    [webhookSection]: {
      listActiveSubscriptions: {
        summary: "Lister les webhooks auxquels vous êtes souscrits",
        description:
          "Cette route permet de lister les webhook auxquels vous êtes souscrits.",
        extraDocs: {
          responses: {
            "200": {
              description: "Retourne les webhooks souscrits",
            },
            "400": {
              description: "Erreur dans le contrat d'api'",
            },
            "401": {
              description: "Utilisateur non authentifié",
              example: error401Example,
            },
            "403": {
              description:
                "Accès non autorisé (veuillez vérifier que vous avez les droits)",
              example: error403Example,
            },
            "429": {
              description:
                "Trop d'appels en cours. Veuillez réessayer dans quelques instants",
              example: error429Example,
            },
          },
        },
      },
      subscribeToWebhook: {
        summary: "Souscription à un webhook",
        description:
          "Cette route permet de souscrire à un webhook. Nous vous appellerons sur l'URL fourni, avec les headers fournis avec une method POST." +
          "Le body de la requête sera un JSON contenant les données de l'évènement. Les différents body possibles sont décrits dans l'onglet 'Callbacks'",
        callbacks: {
          "convention.updated": {
            [subscribeToWebhookExample.callbackUrl]: {
              post: {
                summary: "Votre route de callback",
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      example: callbackBodyExample,
                      schema: zodToJsonSchema(callbackBodySchema) as any,
                    },
                  },
                },
                responses: { 200: { description: "Souscription réussie" } },
              },
            },
          },
        },
        extraDocs: {
          body: {
            example: subscribeToWebhookExample,
          },
          responses: {
            "201": {
              description: "Souscription réussie",
            },
            "400": {
              description: "Lorsque le format fourni, n'est pas valide",
            },
            "401": { description: "Lorsque vous n'êtes pas authentifié" },
            "403": {
              description: "Lorsque vous n'avez pas suffisamment de droits",
            },
            "429": {
              description:
                "Trop d'appels en cours. Veuillez réessayer dans quelques instants",
              example: error429Example,
            },
          },
        },
      },
      unsubscribeToWebhook: {
        summary: "Suppression d'une souscription de webhook",
        description:
          "Cette route permet de supprimer une souscription à un webhook.",
        extraDocs: {
          urlParams: {
            subscriptionId: {
              description: "Identifiant du webhook",
            },
          },
          responses: {
            "204": {
              description: "Suppression du webhook réussie",
            },
            "401": { description: "Lorsque vous n'êtes pas authentifié" },
            "403": {
              description: "Lorsque vous n'avez pas suffisamment de droits",
            },
            "404": {
              description: "La souscription demandée n'est pas trouvée",
            },
            "429": {
              description:
                "Trop d'appels en cours. Veuillez réessayer dans quelques instants",
              example: error429Example,
            },
          },
        },
      },
    },
  });
