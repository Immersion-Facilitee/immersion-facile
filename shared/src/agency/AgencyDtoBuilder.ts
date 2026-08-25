import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { WithAcquisition } from "../acquisition.dto";
import type { AddressDto, DepartmentCode } from "../address/address.dto";
import type { Builder } from "../Builder";
import type { Email } from "../email/email.dto";
import type { DateString } from "../utils/date";
import type {
  AgencyDto,
  AgencyId,
  AgencyKind,
  AgencyStatus,
  DelegationAgencyInfo,
} from "./agency.dto";

const defaultAddress: AddressDto = {
  streetNumberAndAddress: "26 rue de l'adresse par défaut",
  city: "Ville par défaut",
  departmentCode: "86",
  postcode: "86000",
};

export const DATE_CREATION = new Date("2025-02-02").toISOString();

export const SEED_FT_AGENCY_ID = "40400c99-9c0b-bbbb-bb6d-6bb9bd300404";

export const SEED_AGENCY_WITH_REFERS_TO_ID: AgencyId =
  "40400c99-9c0b-bbbb-bb6d-6bb9bd300909";

export const defaultValidatorEmail = "default.validator@mail.com";

const emptyAgency: AgencyDto = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "empty-name",
  createdAt: DATE_CREATION,
  updatedAt: DATE_CREATION,
  status: "active",
  kind: "autre",
  counsellorEmails: [],
  validatorEmails: [],
  contactEmail: "default.contact@mail.com",
  agencySiret: "12345678904444",
  signature: "empty-signature",
  coveredDepartments: [defaultAddress.departmentCode],
  address: defaultAddress,
  position: {
    lat: 48.866667, // Paris lat/lon
    lon: 2.333333,
  },
  logoUrl: null,
  refersToAgencyId: null,
  refersToAgencyName: null,
  refersToAgencyContactEmail: null,
  codeSafir: null,
  statusJustification: null,
  phoneNumber: "+33600000000",
  delegationAgencyInfo: null,
};

export class AgencyDtoBuilder implements Builder<AgencyDto> {
  readonly #agency: AgencyDto;

  constructor(agency: AgencyDto = emptyAgency) {
    this.#agency = agency;
  }

  public static create(id?: AgencyId) {
    return new AgencyDtoBuilder({
      ...emptyAgency,
      ...(id ? { id } : {}),
    });
  }

  public static empty() {
    return new AgencyDtoBuilder({ ...emptyAgency });
  }

  public build() {
    return this.#agency;
  }

  public withAddress(address: AddressDto) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      address,
      coveredDepartments: [
        ...new Set([
          ...(address.departmentCode ? [address.departmentCode] : []),
          ...this.#agency.coveredDepartments,
        ]),
      ],
    });
  }

  public withCreatedAt(createdAt: DateString) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      createdAt,
    });
  }

  public withUpdatedAt(updatedAt: Date) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      updatedAt: updatedAt.toISOString(),
    });
  }

  public withCoveredDepartments(departments: DepartmentCode[]) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      coveredDepartments: departments,
    });
  }

  public withAgencySiret(siret: string) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      agencySiret: siret,
    });
  }

  public withCodeSafir(code: string | null) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      codeSafir: code,
    });
  }

  public withId(id: AgencyId) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      id,
    });
  }

  public withKind(kind: AgencyKind) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      kind,
    });
  }

  public withLogoUrl(logoUrl: AbsoluteUrl | null) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      logoUrl,
    });
  }

  public withName(name: string) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      name,
    });
  }

  public withPhoneNumber(phoneNumber: string) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      phoneNumber,
    });
  }

  public withPosition(lat: number, lon: number) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      position: {
        lat,
        lon,
      },
    });
  }

  public withRefersToAgencyInfo(
    params: {
      refersToAgencyId: AgencyId;
      refersToAgencyName: string;
      refersToAgencyContactEmail: Email;
    } | null,
  ) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      ...(params
        ? params
        : {
            refersToAgencyId: null,
            refersToAgencyName: null,
            refersToAgencyContactEmail: null,
          }),
    });
  }

  public withStatusJustification(statusJustification: string | null) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      statusJustification,
    });
  }

  public withSignature(signature: string) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      signature,
    });
  }

  public withStatus(status: AgencyStatus) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      status,
    });
  }

  withAcquisition(withAcquisition: WithAcquisition) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      ...withAcquisition,
    });
  }

  public withValidatorEmails(validatorEmails: string[]) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      validatorEmails,
    });
  }

  public withAgencyContactEmail(contactEmail: string) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      contactEmail,
    });
  }

  public withDelegationAgencyInfo(delegationAgencyInfo: DelegationAgencyInfo) {
    return new AgencyDtoBuilder({
      ...this.#agency,
      delegationAgencyInfo,
    });
  }
}
