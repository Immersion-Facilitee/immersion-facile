import type { Builder } from "../Builder";
import type { ConventionId } from "../convention/convention.dto";
import type { AssessmentCreator, AssessmentDto } from "./assessment.dto";

const minimalAssessment: AssessmentDto = {
  conventionId: "aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa",
  status: "COMPLETED",
  endedWithAJob: false,
  establishmentFeedback: "Ca s'est bien passé",
  establishmentAdvices: "mon conseil",
  beneficiaryAgreement: null,
  beneficiaryFeedback: null,
  signedAt: null,
  createdAt: new Date("2026-03-15").toISOString(),
};

const fullAssessment: AssessmentDto = {
  conventionId: "aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa",
  status: "PARTIALLY_COMPLETED",
  lastDayOfPresence: new Date("2024-01-01").toISOString(),
  numberOfMissedHours: 10,
  endedWithAJob: true,
  typeOfContract: "CDI",
  contractStartDate: new Date("2026-03-11").toISOString(),
  establishmentFeedback: "Ca s'est bien passé",
  establishmentAdvices: "mon conseil",
  beneficiaryAgreement: null,
  beneficiaryFeedback: null,
  signedAt: null,
  createdAt: new Date("2026-03-15").toISOString(),
};

export class AssessmentDtoBuilder implements Builder<AssessmentDto> {
  constructor(private dto: AssessmentDto = { ...minimalAssessment }) {}
  public build() {
    return this.dto;
  }
  public withMinimalInformations() {
    this.dto = minimalAssessment;
    return this;
  }
  public withFullInformations() {
    this.dto = fullAssessment;
    return this;
  }
  public withConventionId(conventionId: ConventionId) {
    this.dto.conventionId = conventionId;
    return this;
  }

  public withCreatedAt(createdAt: string) {
    this.dto.createdAt = createdAt;
    return this;
  }

  public withCreatedBy(createdBy: AssessmentCreator) {
    this.dto.createdBy = createdBy;
    return this;
  }

  public withBeneficiarySignature(params: {
    beneficiaryAgreement: boolean;
    beneficiaryFeedback: string | null;
    signedAt: string;
  }) {
    this.dto.beneficiaryAgreement = params.beneficiaryAgreement;
    this.dto.beneficiaryFeedback = params.beneficiaryFeedback;
    this.dto.signedAt = params.signedAt;
    return this;
  }
}
