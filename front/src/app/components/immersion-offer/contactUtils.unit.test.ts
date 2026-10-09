import { discoverObjective } from "shared";
import { makeCreateDiscussionValuesForKind } from "src/app/components/immersion-offer/contactUtils";
import type { ContactTranscientData } from "src/app/components/immersion-offer/useTranscientDataFromStorage";

describe("makeCreateDiscussionValuesForKind", () => {
  const ifTranscientData: ContactTranscientData = {
    potentialBeneficiaryFirstName: "John",
    potentialBeneficiaryLastName: "Doe",
    potentialBeneficiaryEmail: "john.doe@mail.com",
    potentialBeneficiaryPhone: "+33611223344",
    datePreferences: "En septembre",
    immersionObjective: "Confirmer un projet professionnel",
    immersionDuration: "short",
    motivation: "J'aime ce métier",
    experienceAdditionalInformation: "Je suis manuel",
    potentialBeneficiaryResumeLink: "https://www.linkedin.com/in/john-doe",
  };

  const miniStageTranscientData: ContactTranscientData = {
    potentialBeneficiaryFirstName: "Jane",
    potentialBeneficiaryLastName: "Doe",
    potentialBeneficiaryEmail: "jane.doe@mail.com",
    potentialBeneficiaryPhone: "+33655667788",
    datePreferences: "Du 16 au 27 juin",
    immersionObjective: discoverObjective,
    levelOfEducation: "2nde",
  };

  it("keeps discover objective for mini-stage when reusing immersion data", () => {
    expect(
      makeCreateDiscussionValuesForKind("1_ELEVE_1_STAGE", ifTranscientData),
    ).toEqual({
      ...ifTranscientData,
      kind: "1_ELEVE_1_STAGE",
      immersionObjective: discoverObjective,
      levelOfEducation: "3ème",
    });
  });

  it("reuses level of education for mini-stage when reusing mini-stage data", () => {
    expect(
      makeCreateDiscussionValuesForKind(
        "1_ELEVE_1_STAGE",
        miniStageTranscientData,
      ),
    ).toEqual({
      ...miniStageTranscientData,
      kind: "1_ELEVE_1_STAGE",
      immersionObjective: discoverObjective,
      levelOfEducation: "2nde",
    });
  });

  it("reuses immersion objective for immersion when reusing immersion data", () => {
    expect(makeCreateDiscussionValuesForKind("IF", ifTranscientData)).toEqual({
      ...ifTranscientData,
      kind: "IF",
      immersionObjective: "Confirmer un projet professionnel",
    });
  });

  it("leaves immersion objective unselected for immersion without transcient data", () => {
    expect(makeCreateDiscussionValuesForKind("IF", null)).toEqual({
      kind: "IF",
      motivation: "",
      experienceAdditionalInformation: "",
    });
  });
});
