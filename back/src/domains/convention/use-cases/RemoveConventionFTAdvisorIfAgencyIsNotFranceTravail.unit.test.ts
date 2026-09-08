import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type FtConnectIdentity,
  type FtConnectImmersionAdvisorDto,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  makeRemoveConventionFTAdvisorIfAgencyIsNotFranceTravail,
  type RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail,
} from "./RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail";

describe("RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";
  const ftAgency = new AgencyDtoBuilder()
    .withId("ft-agency-id")
    .withKind("france-travail")
    .build();
  const missionLocaleAgency = new AgencyDtoBuilder()
    .withId("ml-agency-id")
    .withKind("mission-locale")
    .build();
  const userFtExternalId = "92f44bbf-103d-4312-bd74-217c7d79f618";
  const ftAdvisor: FtConnectImmersionAdvisorDto = {
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@pole-emploi.fr",
    type: "PLACEMENT",
  };

  const federatedIdentity: FtConnectIdentity = {
    provider: "ftConnect",
    token: userFtExternalId,
    payload: {
      advisor: ftAdvisor,
    },
  };

  let uow: InMemoryUnitOfWork;
  let usecase: RemoveConventionFTAdvisorIfAgencyIsNotFranceTravail;

  beforeEach(() => {
    uow = createInMemoryUow();
    usecase = makeRemoveConventionFTAdvisorIfAgencyIsNotFranceTravail({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("Wrong paths", () => {
    it("throws if requested convention is not found", async () => {
      await expectPromiseToFailWithError(
        usecase.execute({
          conventionId,
        }),
        errors.convention.notFound({ conventionId }),
      );
    });

    it("throws if agency is not found", async () => {
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder()
          .withId(conventionId)
          .withAgencyId(missionLocaleAgency.id)
          .build(),
      ]);

      await expectPromiseToFailWithError(
        usecase.execute({
          conventionId,
        }),
        errors.agency.notFound({ agencyId: missionLocaleAgency.id }),
      );
    });
  });

  describe("Right paths", () => {
    it("removes convention France Travail advisor when new agency is not France Travail", async () => {
      const convention = new ConventionDtoBuilder()
        .withId(conventionId)
        .withAgencyId(missionLocaleAgency.id)
        .withFederatedIdentity(federatedIdentity)
        .build();

      uow.conventionRepository.setConventions([convention]);
      uow.agencyRepository.agencies = [
        toAgencyWithRights(missionLocaleAgency, {}),
      ];

      await usecase.execute({
        conventionId,
      });

      expectToEqual(uow.conventionRepository.conventions, [
        new ConventionDtoBuilder(convention)
          .withFederatedIdentity(undefined)
          .build(),
      ]);
    });

    it("keeps convention France Travail advisor when new agency is France Travail", async () => {
      const transferredConvention = new ConventionDtoBuilder()
        .withId(conventionId)
        .withAgencyId(ftAgency.id)
        .withFederatedIdentity(federatedIdentity)
        .build();

      uow.conventionRepository.setConventions([transferredConvention]);
      uow.agencyRepository.agencies = [toAgencyWithRights(ftAgency, {})];

      await usecase.execute({
        conventionId,
      });

      expectToEqual(uow.conventionRepository.conventions, [
        transferredConvention,
      ]);
    });
  });
});
