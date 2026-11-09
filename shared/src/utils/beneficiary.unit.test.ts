import type {
  Beneficiary,
  BeneficiaryRepresentative,
} from "../convention/convention.dto";
import { displayEmergencyContactInfos } from "./beneficiary";

describe("Beneficiary utils", () => {
  const beneficiary: Partial<Beneficiary<"immersion">> = {
    emergencyContact: "Jean Aimarre",
    emergencyContactEmail: "jean.aimarre@mail.com",
    emergencyContactPhone: "0610502021",
  };
  const beneficiaryRepresentativeWithoutPhone: Partial<BeneficiaryRepresentative> =
    {
      firstName: "Thierry",
      lastName: "Aulait",
      email: "thierry.aulait@mail.com",
    };
  const beneficiaryRepresentativeWithoutEmail: Partial<BeneficiaryRepresentative> =
    {
      firstName: "Thierry",
      lastName: "Aulait",
      phone: "0610502025",
    };
  const beneficiaryRepresentative: Partial<BeneficiaryRepresentative> = {
    firstName: "Thierry",
    lastName: "Aulait",
    email: "thierry.aulait@mail.com",
    phone: "0610502025",
  };

  it("should display correctly emergency contact infos with full infos provided", () => {
    const expected = "Thierry AULAIT (0610502025 - thierry.aulait@mail.com)";
    expect(
      displayEmergencyContactInfos({
        beneficiary,
        beneficiaryRepresentative,
      }),
    ).toEqual(expected);
  });

  it("should display correctly emergency contact infos without phone", () => {
    const expected = "Thierry AULAIT (thierry.aulait@mail.com)";
    expect(
      displayEmergencyContactInfos({
        beneficiary,
        beneficiaryRepresentative: beneficiaryRepresentativeWithoutPhone,
      }),
    ).toEqual(expected);
  });

  it("should display correctly emergency contact infos without email", () => {
    const expected = "Thierry AULAIT (0610502025)";
    expect(
      displayEmergencyContactInfos({
        beneficiary,
        beneficiaryRepresentative: beneficiaryRepresentativeWithoutEmail,
      }),
    ).toEqual(expected);
  });

  it("should display correctly emergency contact infos without beneficiaryRepresentative", () => {
    const expected = "Jean Aimarre (0610502021 - jean.aimarre@mail.com)";
    expect(
      displayEmergencyContactInfos({
        beneficiary,
      }),
    ).toEqual(expected);
  });
});
