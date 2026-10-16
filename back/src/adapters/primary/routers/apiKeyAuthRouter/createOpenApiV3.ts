import {
  type ContactEstablishmentPublicV3Dto,
  publicApiV3SearchEstablishmentRoutes,
  type SearchImmersionResultPublicV3,
} from "shared";
import { createOpenApiGenerator } from "shared-routes/openapi";

const contactByEmailIFExample: ContactEstablishmentPublicV3Dto = {
  kind: "IF",
  contactMode: "EMAIL",
  potentialBeneficiaryFirstName: "John",
  potentialBeneficiaryLastName: "Doe",
  potentialBeneficiaryEmail: "john.doe@mail.com",
  appellationCode: "11573",
  siret: "12345678912345",
  potentialBeneficiaryPhone: "0123456789",
  immersionObjective: "Découvrir un métier ou un secteur d'activité",
  locationId: "123",
  datePreferences: "dans le mois qui vient",
};

const contactByPhone1Eleve1StageExample: ContactEstablishmentPublicV3Dto = {
  kind: "1_ELEVE_1_STAGE",
  contactMode: "PHONE",
  potentialBeneficiaryFirstName: "John",
  potentialBeneficiaryLastName: "Doe",
  potentialBeneficiaryEmail: "john.doe@mail.com",
  appellationCode: "11573",
  siret: "12345678912345",
  potentialBeneficiaryPhone: "0123456789",
  immersionObjective: "Découvrir un métier ou un secteur d'activité",
  locationId: "123",
  datePreferences: "dans le mois qui vient",
  levelOfEducation: "2nde",
};

const searchImmersionResult: SearchImmersionResultPublicV3 = {
  additionalInformation: "Some additional information",
  address: {
    departmentCode: "75",
    postcode: "75001",
    streetNumberAndAddress: "1 rue de Rivoli",
    city: "Paris",
  },
  rome: "B1805",
  romeLabel: "Stylisme",
  establishmentScore: 0,
  appellations: [
    {
      appellationCode: "19540",
      appellationLabel: "Styliste",
    },
    {
      appellationCode: "12831",
      appellationLabel:
        "Concepteur / Conceptrice maquettiste en accessoires de mode",
    },
  ],
  contactMode: "EMAIL",
  distance_m: 1225,
  naf: "123",
  nafLabel: "Fabrication de vêtements",
  name: "Raison sociale de ma super boite",
  numberOfEmployeeRange: "",
  position: {
    lat: 48.8589507,
    lon: 2.3468078,
  },
  siret: "11110000222200",
  voluntaryToImmersion: true,
  website: "http://www.masuperboite.com",
  locationId: "123",
  fitForDisabledWorkers: "no",
  remoteWorkMode: "ON_SITE",
  isAvailable: true,
};

const withAuthorizationHeader = {
  authorization: {
    description:
      "La clé API à fournir. (Pas besoin de 'Bearer xxx', juste 'xxx')",
    example: "my-jwt-token",
  },
};

const apiKeyAuth = "apiKeyAuth";

const searchSection = "Recherche d'entreprise accueillante et mise en contact";

const generateOpenApi = (envType: string) =>
  createOpenApiGenerator(
    {
      [searchSection]: publicApiV3SearchEstablishmentRoutes,
    },
    {
      info: {
        title: "Les API Immersion facilitée (V3: en cours de developpement)",
        description: `Ceci est la documentation pour consommer l’api d’immersion facilitée, en version 3. <a href="/doc-api" id='doc-api-link-from-v3-to-v2'>Consulter la v2</a>
      Une clé API est nécessaire pour utiliser l’api. Veuillez vous mettre en contact avec l’équipe d’immersion facilitée pour l’obtenir.
      Vous aurez à préciser ce dont vous avez besoin :
      <ul>
      <li>la partie recherche d’entreprise</li> 
      <li>la partie accès aux conventions : se référerer à la V2 de l'api</li>
      </ul>
     La clé API est à fournir en authorization header de toutes les requêtes.
      `,
        version: "v3",
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

export const createOpenApiSpecV3 = (envType: string) =>
  generateOpenApi(envType)({
    [searchSection]: {
      getOffers: {
        summary: "Recherche",
        description:
          "Retourne un tableau d'offres d'immersion correspondant à la recherche",
        extraDocs: {
          headerParams: withAuthorizationHeader,
          queryParams: {
            longitude: {
              example: 2.34839,
              description: "Coordonnées de latitude",
            },
            latitude: {
              example: 48.8535,
              description: "Coordonnées de longitude",
            },
            distanceKm: {
              example: 10,
              description: "Rayon de la recherche en km",
            },
            appellationCodes: {
              example: ["11573", "38444"],
              description: "Tableau de codes appellation à 5 chiffres",
            },
            departmentCodes: {
              example: ["75", "76"],
              description:
                "Tableau de codes département des localisations d'établissement",
            },
            sortBy: {
              example: "distance",
              description: "Critère de tri des résultats de recheche",
            },
          },
          responses: {
            "200": {
              description: "Opération réussie",
              example: {
                data: [searchImmersionResult],
                pagination: {
                  totalRecords: 1,
                  currentPage: 1,
                  totalPages: 1,
                  numberPerPage: 10,
                },
              },
            },
            "400": {
              description: "Requête invalide: paramètres d'entrées invalides",
              example: {
                status: 400,
                message:
                  "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /v2/contact-establishment",
                issues: ["siret : SIRET doit être composé de 14 chiffres"],
              },
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
      getOffer: {
        summary: "Récupération d’un résultat de recherche d'immersion connu",
        description:
          "Renvoie l'offre d'immersion correspondante." +
          "Les établissements peuvent également être supprimés et les métiers peuvent évoluer. Dans ce cas il y aura un retour 404.",
        extraDocs: {
          headerParams: withAuthorizationHeader,
          urlParams: {
            siret: {
              description:
                "Siret (14 chiffres) de l'entreprise proposant l'offre d'immersion",
              example: "11110000222200",
            },

            appellationCode: {
              description: "Code appellation à 5 chiffres",
              example: "12001",
            },

            locationId: {
              description: "Identifiant de la localisation de l'entreprise",
              example: "11111111-1111-4444-1111-111111111111",
            },
          },
          responses: {
            "200": {
              description: "Opération réussie",
              example: searchImmersionResult,
            },
            "400": {
              description: "Dans le cas d'une requête invalide",
              example: {
                status: 400,
                message: "Schema validation failed",
                issues: ["siret: SIRET doit être composé de 14 chiffres"],
              },
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
              description: "Résultat non trouvé",
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

      contactEstablishment: {
        summary: "Mise en contact",
        description: `!Vous devez fournir le mode de contact qui a été renseigné par l’entreprise (dans les résultats de recherche) !. Ce qui se passe:
      
      EMAIL : L’entreprise va recevoir le message du candidat par email et c’est la responsabilité de l’entreprise de recontacter le candidat (le mail du candidat est fourni à l’entreprise).
      
      PHONE : Dans le cas téléphone le candidat va recevoir un email avec le téléphone de la personne à contacter dans l’entreprise.
      
      IN_PERSON : Dans le cas en personne le candidat reçoit un email avec le nom de la personne, et l’adresse de l’entreprise et doit se présenter en personne.`,

        extraDocs: {
          headerParams: withAuthorizationHeader,
          body: {
            examples: {
              email: {
                summary: "Contact par mail dans le cas IF",
                description:
                  "Une demande de mise en contact, pour une entreprise devant être contacté par email",
                value: contactByEmailIFExample,
              },
              phone: {
                summary: "Contact par téléphone dans le cas 1 jeune 1 stage",
                description:
                  "Une demande de mise en contact, pour une entreprise devant être contacté par téléphone",
                value: contactByPhone1Eleve1StageExample,
              },
            },
          },
          responses: {
            "201": {
              description: "Opération réussie",
            },
            "400": {
              description:
                "Error dans la contrat, ou le mode de contact ne correspond pas à celui renseigné par l'entreprise",
              example: {
                status: 400,
                message:
                  "Contact mode mismatch: 'EMAIL' in params. In contact (fetched with siret) : 'PHONE'",
              },
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
              description: "Établissement/Contact non trouvé",
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
    },
  });
