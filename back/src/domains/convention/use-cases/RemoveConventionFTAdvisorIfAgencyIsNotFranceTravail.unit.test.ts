import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  type ConventionId,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import type { FtConnectImmersionAdvisorDto } from "../../core/authentication/ft-connect/dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../../core/authentication/ft-connect/dto/FtConnectUserDto";
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
  const ftConnectUser: FtConnectUserDto = {
    email: "",
    firstName: "",
    isJobseeker: true,
    lastName: "",
    ftExternalId: userFtExternalId,
    birthdate: "1990-01-01",
  };
  const ftAdvisor: FtConnectImmersionAdvisorDto = {
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@pole-emploi.fr",
    type: "PLACEMENT",
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
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder()
          .withId(conventionId)
          .withAgencyId(missionLocaleAgency.id)
          .build(),
      ]);
      uow.agencyRepository.agencies = [
        toAgencyWithRights(missionLocaleAgency, {}),
      ];
      saveConventionFranceTravailAdvisor({
        advisor: ftAdvisor,
        user: ftConnectUser,
        conventionId,
      });

      await usecase.execute({
        conventionId,
      });

      expectToEqual(
        uow.conventionFranceTravailAdvisorRepository
          .conventionFranceTravailUsers,
        {},
      );
      expectToEqual(
        uow.conventionFranceTravailAdvisorRepository.ftConnectedUsers,
        {},
      );
    });

    it("keeps ftConnectUser when it is still linked to another convention", async () => {
      const otherConventionId = "970cc531-088d-42e5-8385-48a7fd4e5fa5";
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder()
          .withId(conventionId)
          .withAgencyId(missionLocaleAgency.id)
          .build(),
        new ConventionDtoBuilder()
          .withId(otherConventionId)
          .withAgencyId(missionLocaleAgency.id)
          .build(),
      ]);
      uow.agencyRepository.agencies = [
        toAgencyWithRights(missionLocaleAgency, {}),
      ];
      saveConventionFranceTravailAdvisor({
        advisor: ftAdvisor,
        user: ftConnectUser,
        conventionId,
      });
      uow.conventionFranceTravailAdvisorRepository.conventionFranceTravailUsers[
        otherConventionId
      ] = userFtExternalId;

      await usecase.execute({
        conventionId,
      });

      expectToEqual(
        uow.conventionFranceTravailAdvisorRepository
          .conventionFranceTravailUsers,
        {
          [otherConventionId]: userFtExternalId,
        },
      );
      expectToEqual(
        uow.conventionFranceTravailAdvisorRepository.ftConnectedUsers,
        {
          [userFtExternalId]: {
            advisor: ftAdvisor,
            user: ftConnectUser,
          },
        },
      );
    });

    it("keeps convention France Travail advisor when new agency is France Travail", async () => {
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder()
          .withId(conventionId)
          .withAgencyId(ftAgency.id)
          .build(),
      ]);
      uow.agencyRepository.agencies = [toAgencyWithRights(ftAgency, {})];
      saveConventionFranceTravailAdvisor({
        advisor: ftAdvisor,
        user: ftConnectUser,
        conventionId,
      });

      await usecase.execute({
        conventionId,
      });

      expectToEqual(
        uow.conventionFranceTravailAdvisorRepository
          .conventionFranceTravailUsers,
        {
          [conventionId]: ftConnectUser.ftExternalId,
        },
      );
    });
  });

  const saveConventionFranceTravailAdvisor = ({
    advisor,
    user,
    conventionId,
  }: {
    advisor: FtConnectImmersionAdvisorDto;
    user: FtConnectUserDto;
    conventionId: ConventionId;
  }) => {
    uow.conventionFranceTravailAdvisorRepository.conventionFranceTravailUsers[
      conventionId
    ] = user.ftExternalId;
    uow.conventionFranceTravailAdvisorRepository.ftConnectedUsers[
      user.ftExternalId
    ] = {
      advisor,
      user,
    };
  };
});
