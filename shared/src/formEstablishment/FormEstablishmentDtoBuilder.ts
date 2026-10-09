import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { WithAcquisition } from "../acquisition.dto";
import type { AddressAndPosition } from "../address/address.dto";
import type { Builder } from "../Builder";
import { errors } from "../errors/errors";
import type { WithBannedEstablishmentInformations } from "../establishment/bannedEstablishmentInformations.dto";
import type { NafDto } from "../naf/naf.dto";
import type { SiretDto } from "../siret/siret";
import type {
  ContactMode,
  EstablishmentCSVRow,
  EstablishmentFormOffer,
  EstablishmentSearchableBy,
  FitForDisableWorkerOption,
  FormEstablishmentAddress,
  FormEstablishmentDto,
  FormEstablishmentSource,
  FormEstablishmentUserRight,
} from "./FormEstablishment.dto";
import { defaultMaxContactsPerMonth } from "./FormEstablishment.schema";

type TestAddress = {
  formAddress: FormEstablishmentAddress;
  addressAndPosition: AddressAndPosition;
};

export const defaultAddress: TestAddress = {
  formAddress: {
    id: "364efc5a-db4f-452c-8d20-95c6a23f21fe",
    rawAddress: "1 Rue du Moulin, 27110 Épreville-près-le-Neubourg, France",
  },
  addressAndPosition: {
    address: {
      city: "Épreville-près-le-Neubourg",
      departmentCode: "27",
      postcode: "27110",
      streetNumberAndAddress: "1 Rue du Moulin",
    },
    position: {
      lat: 49.137593,
      lon: 0.8746325,
    },
  },
};

export const updatedAddress1: TestAddress = {
  formAddress: {
    id: "fbd6096d-b514-4d54-a16e-46c89f75d83c",
    rawAddress: "1 rue de la paix, 75001 Paris",
  },
  addressAndPosition: {
    address: {
      city: "Paris",
      departmentCode: "75",
      postcode: "75001",
      streetNumberAndAddress: "1 rue de la paix",
    },
    position: {
      lat: 48.8685535,
      lon: 2.3303318,
    },
  },
};

export const updatedAddress2: TestAddress = {
  formAddress: {
    id: "fbd6096d-b514-4d54-a16e-46c89f75d83d",
    rawAddress: "2 Rue de la Paix, 93100 Montreuil, France",
  },
  addressAndPosition: {
    address: {
      city: "Montreuil",
      departmentCode: "93",
      postcode: "93100",
      streetNumberAndAddress: "2 rue de la paix",
    },
    position: {
      lat: 48.860428,
      lon: 2.473908,
    },
  },
};

export const defaultValidFormEstablishment: FormEstablishmentDto = {
  source: "immersion-facile",
  businessAddresses: [defaultAddress.formAddress],
  userRights: [
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      email: "amil@mail.com",
      job: "a job",
      phone: "+33612345678",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
    {
      role: "establishment-contact",
      status: "ACCEPTED",
      email: "copy1@mail.com",
      shouldReceiveDiscussionNotifications: false,
    },
    {
      role: "establishment-contact",
      status: "ACCEPTED",
      email: "copy2@mail.com",
      shouldReceiveDiscussionNotifications: true,
    },
  ],
  contactMode: "EMAIL",
  naf: { code: "7201A", nomenclature: "nomenclature code 7201A" },
  businessName: "Ma super entreprise",
  businessNameCustomized: "Ma belle enseigne du quartier",
  fitForDisabledWorkers: "no",
  siret: "01234567890123",
  website: "https://www@super.com/jobs",
  additionalInformation: "",
  offers: [
    {
      romeCode: "A1111",
      appellationCode: "11111",
      romeLabel: "Boulangerie",
      appellationLabel: "Boulanger - Boulangère",
      remoteWorkMode: "ON_SITE",
    },
    {
      romeCode: "B9112",
      appellationCode: "22222",
      romeLabel: "Patissier",
      appellationLabel: "Patissier - Patissière",
      remoteWorkMode: "ON_SITE",
    },
    {
      romeCode: "D1103",
      appellationCode: "33333",
      romeLabel: "Boucherie",
      appellationLabel: "Boucher / Bouchère",
      remoteWorkMode: "ON_SITE",
    },
  ],
  maxContactsPerMonth: defaultMaxContactsPerMonth,
  searchableBy: {
    jobSeekers: true,
    students: true,
  },
  acquisitionKeyword: undefined,
  acquisitionCampaign: undefined,
  isEstablishmentBanned: false,
};

export const fullyUpdatedFormEstablishment: FormEstablishmentDto = {
  source: "immersion-facile",
  businessAddresses: [updatedAddress1.formAddress, updatedAddress2.formAddress],
  userRights: [
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      email: "my-updated-email@test.com",
      job: "new job",
      phone: "+33612345679",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: true,
    },
    {
      role: "establishment-contact",
      status: "ACCEPTED",
      email: "updated-copy-email@test.com",
      shouldReceiveDiscussionNotifications: false,
    },
  ],
  contactMode: "PHONE",
  naf: { code: "8054B", nomenclature: "nomenclature code B" },
  businessName: "Edited Business Name",
  siret: "01234567890123",
  website: "https://updated.website.com",
  additionalInformation: "This is an updated information",
  offers: [
    {
      romeCode: "A1234",
      appellationCode: "11234",
      romeLabel: "Label rome 1",
      appellationLabel: "Appellation 1",
      remoteWorkMode: "ON_SITE",
    },
    {
      romeCode: "B1234",
      appellationCode: "21234",
      romeLabel: "Label rome 2",
      appellationLabel: "Appellation 2",
      remoteWorkMode: "ON_SITE",
    },
  ],
  maxContactsPerMonth: defaultMaxContactsPerMonth - 5,
  searchableBy: {
    jobSeekers: false,
    students: true,
  },
  businessNameCustomized: "Updated Business Name",
  fitForDisabledWorkers: "no",
  nextAvailabilityDate: new Date("2025-02-01").toISOString(),
  isEstablishmentBanned: false,
};

const emptyFormEstablishment: FormEstablishmentDto = {
  source: "immersion-facile",
  businessAddresses: [
    {
      id: "",
      rawAddress: "",
    },
  ],
  naf: { code: "", nomenclature: "" },

  contactMode: "EMAIL",
  userRights: [],
  businessName: "",
  siret: "",
  offers: [],
  website: "",
  additionalInformation: "",
  fitForDisabledWorkers: "no",
  maxContactsPerMonth: defaultMaxContactsPerMonth,
  searchableBy: {
    jobSeekers: true,
    students: false,
  },
  acquisitionKeyword: undefined,
  acquisitionCampaign: undefined,
  isEstablishmentBanned: false,
};

export class FormEstablishmentDtoBuilder
  implements Builder<FormEstablishmentDto>
{
  #dto: FormEstablishmentDto;

  constructor(dto: FormEstablishmentDto) {
    this.#dto = dto;
  }

  public static valid() {
    return new FormEstablishmentDtoBuilder(defaultValidFormEstablishment);
  }

  public static allEmptyFields() {
    return new FormEstablishmentDtoBuilder(emptyFormEstablishment);
  }

  public static fullyUpdated() {
    return new FormEstablishmentDtoBuilder(fullyUpdatedFormEstablishment);
  }

  public build() {
    return this.#dto;
  }

  public withOffers(offers: EstablishmentFormOffer[]) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      offers,
    });
  }

  public buildCsvRow(): EstablishmentCSVRow {
    return formEstablishmentToEstablishmentCsvRow(this.#dto);
  }

  public withBusinessAddresses(businessAddresses: FormEstablishmentAddress[]) {
    return new FormEstablishmentDtoBuilder({ ...this.#dto, businessAddresses });
  }

  public withUserRights(
    establishmentFormUserRights: FormEstablishmentUserRight[],
  ) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      userRights: establishmentFormUserRights,
    });
  }

  public withBusinessName(businessName: string) {
    return new FormEstablishmentDtoBuilder({ ...this.#dto, businessName });
  }

  public withFitForDisabledWorkers(
    fitForDisabledWorkers: FitForDisableWorkerOption,
  ) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      fitForDisabledWorkers,
    });
  }

  public withMaxContactsPerMonth(maxContactsPerMonth: number) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      maxContactsPerMonth: maxContactsPerMonth,
    });
  }

  public withNextAvailabilityDate(nextAvailabilityDate: Date | undefined) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      nextAvailabilityDate: nextAvailabilityDate?.toISOString(),
    });
  }

  public withContactMode(contactMode: ContactMode) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      contactMode,
    });
  }

  public withBusinessNameCustomized(businessNameCustomized?: string) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      businessNameCustomized,
    });
  }

  public withAdditionalInformation(additionalInformation?: string) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      additionalInformation,
    });
  }

  public withWebsite(website?: AbsoluteUrl) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      website,
    });
  }

  public withSiret(siret: SiretDto) {
    return new FormEstablishmentDtoBuilder({ ...this.#dto, siret });
  }

  public withSource(source: FormEstablishmentSource) {
    return new FormEstablishmentDtoBuilder({ ...this.#dto, source });
  }

  public withAcquisition(params: WithAcquisition) {
    return new FormEstablishmentDtoBuilder({ ...this.#dto, ...params });
  }

  public withSearchableBy({ jobSeekers, students }: EstablishmentSearchableBy) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      searchableBy: { jobSeekers, students },
    });
  }

  public withNaf(naf?: NafDto) {
    return new FormEstablishmentDtoBuilder({ ...this.#dto, naf });
  }

  public withBannishmentInformations(
    bannishmentInformations: WithBannedEstablishmentInformations,
  ) {
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      ...bannishmentInformations,
    });
  }

  public withPotentialBeneficiaryWelcomeAddress(
    potentialBeneficiaryWelcomeAddress: AddressAndPosition,
  ) {
    if (this.#dto.contactMode !== "IN_PERSON") {
      throw new Error(
        "Potential beneficiary welcome address is only available for IN_PERSON contact mode",
      );
    }
    return new FormEstablishmentDtoBuilder({
      ...this.#dto,
      potentialBeneficiaryWelcomeAddress,
    });
  }
}

const formEstablishmentToEstablishmentCsvRow = (
  establishment: FormEstablishmentDto,
): EstablishmentCSVRow => {
  const [
    userRight1,
    userRight2,
    userRight3,
    userRight4,
    userRight5,
    userRight6,
    userRight7,
    userRight8,
    userRight9,
    userRight10,
  ] = establishment.userRights;
  if (userRight1.role !== "establishment-admin")
    throw errors.establishmentCsv.firstUserMustBeAdmin(userRight1.email);
  return {
    businessAddress: establishment.businessAddresses[0].rawAddress,
    contactMode: establishment.contactMode,
    naf_code: establishment.naf?.code ?? "",
    businessName: establishment.businessName,
    businessNameCustomized: establishment.businessNameCustomized ?? "",
    siret: establishment.siret,
    website: establishment.website ?? "",
    additionalInformation: establishment.additionalInformation ?? "",
    offers_appellation_code: establishment.offers
      .map((offer) => offer.appellationCode)
      .join(","),
    maxContactPerMonth: String(establishment.maxContactsPerMonth),
    fitForDisabledWorkers: establishment.fitForDisabledWorkers ? "1" : "0",
    searchableByStudents: establishment.searchableBy.students ? "1" : "0",
    searchableByJobSeekers: establishment.searchableBy.jobSeekers ? "1" : "0",
    right1_email: userRight1.email,
    right1_job: userRight1.job,
    right1_phone: userRight1.phone,
    ...(userRight2
      ? {
          right2_role: userRight2.role,
          right2_job: userRight2.job,
          right2_phone: userRight2.phone,
          right2_email: userRight2.email,
        }
      : {}),
    ...(userRight3
      ? {
          right3_role: userRight3.role,
          right3_job: userRight3.job,
          right3_phone: userRight3.phone,
          right3_email: userRight3.email,
        }
      : {}),

    ...(userRight4
      ? {
          right4_role: userRight4.role,
          right4_job: userRight4.job,
          right4_phone: userRight4.phone,
          right4_email: userRight4.email,
        }
      : {}),

    ...(userRight5
      ? {
          right5_role: userRight5.role,
          right5_job: userRight5.job,
          right5_phone: userRight5.phone,
          right5_email: userRight5.email,
        }
      : {}),

    ...(userRight6
      ? {
          right6_role: userRight6.role,
          right6_job: userRight6.job,
          right6_phone: userRight6.phone,
          right6_email: userRight6.email,
        }
      : {}),

    ...(userRight7
      ? {
          right7_role: userRight7.role,
          right7_job: userRight7.job,
          right7_phone: userRight7.phone,
          right7_email: userRight7.email,
        }
      : {}),

    ...(userRight8
      ? {
          right8_role: userRight8.role,
          right8_job: userRight8.job,
          right8_phone: userRight8.phone,
          right8_email: userRight8.email,
        }
      : {}),

    ...(userRight9
      ? {
          right9_role: userRight9.role,
          right9_job: userRight9.job,
          right9_phone: userRight9.phone,
          right9_email: userRight9.email,
        }
      : {}),

    ...(userRight10
      ? {
          right10_role: userRight10.role,
          right10_job: userRight10.job,
          right10_phone: userRight10.phone,
          right10_email: userRight10.email,
        }
      : {}),
  };
};
