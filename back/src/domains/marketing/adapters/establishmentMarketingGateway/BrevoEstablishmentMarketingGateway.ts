import Bottleneck from "bottleneck";
import {
  type Email,
  numberOfEmployeesRangeSchema,
  ONE_SECOND_MS,
} from "shared";
import type { HttpClient } from "shared-routes";
import type { BrevoHeaders } from "../../../../utils/apiBrevoUrl";
import type {
  EstablishmentMarketingGateway,
  EstablishmentMarketingGatewayDto,
  EstablishmentMarketingSearchableBy,
} from "../../ports/EstablishmentMarketingGateway";
import type {
  CreateContactBody,
  GetContactInfoResponseBody,
  TypePublic,
} from "./BrevoContact.dto";
import type { BrevoContactRoutes } from "./BrevoContact.routes";

type BrevoEstablishmentMarketingGatewayParams = {
  httpClient: HttpClient<BrevoContactRoutes>;
  apiKey: string;
  establishmentContactListId: number;
};

const brevoMaxContactRequestsPerSeconds = 5;

export type BrevoContact = {
  contact: EstablishmentMarketingGatewayDto;
  lists: number[];
};

export class BrevoEstablishmentMarketingGateway
  implements EstablishmentMarketingGateway
{
  constructor({
    httpClient,
    apiKey,
    establishmentContactListId,
  }: BrevoEstablishmentMarketingGatewayParams) {
    this.#httpClient = httpClient;
    this.#brevoHeaders = {
      accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    };
    this.#establishmentContactListId = establishmentContactListId;
  }

  async save(dto: EstablishmentMarketingGatewayDto): Promise<void> {
    const existingContact = await this.getContactByEmail(dto.email);
    const body: CreateContactBody = {
      email: dto.email,
      listIds: [this.#establishmentContactListId],
      attributes: {
        EMAIL: dto.email,
        NOM: dto.firstName,
        PRENOM: dto.lastName,
        ENT_COMPTE_IC: dto.hasIcAccount,
        ENT_REFERENCE_SITE: dto.isRegistered,
        ENT_SIRET: dto.siret,
        ENT_NB_CONVENTION: dto.conventions.numberOfValidatedConvention,
        ENT_EFFECTIF: dto.numberEmployeesRange ?? "",
        ENT_DATE_VALIDATION_DERNIERE_CONVENTION: dto.conventions.lastConvention
          ? dto.conventions.lastConvention.validationDate.toISOString()
          : "",
        ENT_DATE_FIN_DERNIERE_CONVENTION: dto.conventions.lastConvention
          ? dto.conventions.lastConvention.endDate.toISOString()
          : "",
        ENT_DATE_PREM_CONVENTION: dto.conventions.firstConventionValidationDate
          ? dto.conventions.firstConventionValidationDate.toISOString()
          : "",
        ENT_CODE_DEPARTEMENT: dto.isRegistered ? dto.departmentCode : "",
        ENT_CODE_NAF: dto.isRegistered ? dto.nafCode : "",
        ENT_DATE_DISPO:
          dto.isRegistered && dto.nextAvailabilityDate
            ? dto.nextAvailabilityDate.toISOString()
            : "",
        ENT_LES_ENTREPRISES_SENGAGENT:
          dto.isRegistered && dto.isCommited !== undefined
            ? dto.isCommited
            : "",
        ENT_MAX_CONTACTS_PER_MONTH: dto.isRegistered
          ? dto.maxContactsPerMonth
          : "",
        ENT_NOMBRE_MER_RECUES: dto.isRegistered
          ? dto.numberOfDiscussionsReceived
          : "",
        ENT_NOMBRE_REPONSES_MER: dto.isRegistered
          ? dto.numberOfDiscussionsAnswered
          : "",
        ENT_ROMES: dto.isRegistered ? dto.romes.toString() : "",
        ENT_TYPE_PUBLIC_ACCUEILLIS: dto.isRegistered
          ? searchableToTypePublic[dto.searchableBy]
          : "",
        ENT_SUPER_ENTREPRISE: dto.isRegistered ? dto.isSuperEstablishment : "",
      },
      updateEnabled: !!existingContact,
    };

    await this.#createContact(body);
  }

  async delete(contactEmail: Email): Promise<void> {
    const existingContact = await this.getContactByEmail(contactEmail);

    if (
      !existingContact ||
      !existingContact.lists.includes(this.#establishmentContactListId)
    )
      return;

    return existingContact.lists.length === 1
      ? this.#deleteContactByEmail(contactEmail)
      : this.#createContact({
          attributes: {
            EMAIL: contactEmail,
            NOM: "",
            PRENOM: "",
            ENT_COMPTE_IC: "",
            ENT_REFERENCE_SITE: "",
            ENT_SIRET: "",
            ENT_NB_CONVENTION: "",
            ENT_EFFECTIF: "",
            ENT_DATE_VALIDATION_DERNIERE_CONVENTION: "",
            ENT_DATE_FIN_DERNIERE_CONVENTION: "",
            ENT_DATE_PREM_CONVENTION: "",
            ENT_CODE_DEPARTEMENT: "",
            ENT_CODE_NAF: "",
            ENT_DATE_DISPO: "",
            ENT_LES_ENTREPRISES_SENGAGENT: "",
            ENT_MAX_CONTACTS_PER_MONTH: "",
            ENT_NOMBRE_MER_RECUES: "",
            ENT_NOMBRE_REPONSES_MER: "",
            ENT_ROMES: "",
            ENT_TYPE_PUBLIC_ACCUEILLIS: "",
          },
          email: contactEmail,
          listIds: existingContact.lists.filter(
            (listId) => listId !== this.#establishmentContactListId,
          ),
          updateEnabled: true,
        }).then(() =>
          this.#removeContactFromList({
            email: contactEmail,
            listId: this.#establishmentContactListId.toString(),
          }),
        );
  }

  #removeContactFromList({
    email,
    listId,
  }: {
    email: Email;
    listId: string;
  }): Promise<void> {
    return this.#contactLimiter
      .schedule(() =>
        this.#httpClient.deleteContactFromList({
          body: { emails: [email] },
          headers: this.#brevoHeaders,
          urlParams: { listId },
        }),
      )
      .then((response) => {
        if (response.status === 201) {
          if (response.body.contacts.success.includes(email)) return;
          if (response.body.contacts.failure.includes(email))
            throw new Error(
              `Remove contact '${email}' from list '${listId}' failed`,
            );
          throw new Error("Should not occurs.");
        }

        throw new Error(
          `Bad response with status '${response.status}' and body '${response.body}'`,
        );
      });
  }

  async getContactByEmail(email: Email): Promise<BrevoContact | undefined> {
    return this.#contactLimiter
      .schedule(() =>
        this.#httpClient.getContact({
          urlParams: { identifier: email },
          headers: this.#brevoHeaders,
        }),
      )
      .then((response) => {
        if (response.status === 200)
          return this.#makeContactFromGetContactResponse(response.body);
        if (response.status === 404) return;
      });
  }

  #makeContactFromGetContactResponse({
    attributes,
    listIds,
    email,
  }: GetContactInfoResponseBody): BrevoContact {
    const isRegistered = attributes.ENT_REFERENCE_SITE ?? false;
    return {
      contact: {
        email,
        firstName: attributes.NOM ?? "",
        lastName: attributes.PRENOM ?? "",
        conventions: {
          numberOfValidatedConvention: attributes.ENT_NB_CONVENTION ?? -1,
          ...(attributes.ENT_DATE_PREM_CONVENTION !== undefined
            ? {
                firstConventionValidationDate: new Date(
                  attributes.ENT_DATE_PREM_CONVENTION,
                ),
              }
            : {}),
          ...(attributes.ENT_DATE_FIN_DERNIERE_CONVENTION !== undefined &&
          attributes.ENT_DATE_VALIDATION_DERNIERE_CONVENTION !== undefined
            ? {
                lastConvention: {
                  endDate: new Date(
                    attributes.ENT_DATE_FIN_DERNIERE_CONVENTION,
                  ),
                  validationDate: new Date(
                    attributes.ENT_DATE_VALIDATION_DERNIERE_CONVENTION,
                  ),
                },
              }
            : {}),
        },
        siret: attributes.ENT_SIRET ?? "",
        numberEmployeesRange: attributes.ENT_EFFECTIF
          ? numberOfEmployeesRangeSchema.parse(attributes.ENT_EFFECTIF)
          : "0",
        hasIcAccount: attributes.ENT_COMPTE_IC ?? false,
        ...(isRegistered === true
          ? {
              isRegistered,
              departmentCode: attributes.ENT_CODE_DEPARTEMENT ?? "",
              isCommited: attributes.ENT_LES_ENTREPRISES_SENGAGENT ?? false,
              maxContactsPerMonth: attributes.ENT_MAX_CONTACTS_PER_MONTH ?? -1,
              nafCode: attributes.ENT_CODE_NAF ?? "",
              ...(attributes.ENT_DATE_DISPO !== undefined
                ? {
                    nextAvailabilityDate: new Date(attributes.ENT_DATE_DISPO),
                  }
                : {}),
              numberOfDiscussionsReceived:
                attributes.ENT_NOMBRE_MER_RECUES ?? -1,
              numberOfDiscussionsAnswered:
                attributes.ENT_NOMBRE_REPONSES_MER ?? -1,
              searchableBy:
                typePublicToSearchable[
                  attributes.ENT_TYPE_PUBLIC_ACCUEILLIS ?? "1"
                ],
              romes: attributes.ENT_ROMES
                ? attributes.ENT_ROMES.split(",")
                : [],
              isSuperEstablishment: attributes.ENT_SUPER_ENTREPRISE ?? false,
            }
          : { isRegistered }),
      },
      lists: listIds,
    };
  }

  #createContact(body: CreateContactBody) {
    return this.#contactLimiter.schedule(() =>
      this.#httpClient.createContact({
        headers: this.#brevoHeaders,
        body,
      }),
    );
  }

  #deleteContactByEmail(email: Email): Promise<void> {
    return this.#contactLimiter
      .schedule(() =>
        this.#httpClient.deleteContact({
          urlParams: { identifier: email },
          headers: this.#brevoHeaders,
        }),
      )
      .then((response) => {
        if (response.status !== 204)
          throw new Error(
            `Bad response with status '${response.status}' and body '${response.body}'`,
          );
      });
  }

  #httpClient: HttpClient<BrevoContactRoutes>;
  #brevoHeaders: BrevoHeaders;
  #establishmentContactListId: number;
  #contactLimiter = new Bottleneck({
    reservoir: brevoMaxContactRequestsPerSeconds,
    reservoirRefreshInterval: ONE_SECOND_MS, // number of ms
    reservoirRefreshAmount: brevoMaxContactRequestsPerSeconds,
  });
}

const searchableToTypePublic: Record<
  EstablishmentMarketingSearchableBy,
  TypePublic
> = {
  all: "3",
  jobSeekers: "2",
  students: "1",
};

const typePublicToSearchable: Record<
  TypePublic,
  EstablishmentMarketingSearchableBy
> = {
  "3": "all",
  "2": "jobSeekers",
  "1": "students",
};
