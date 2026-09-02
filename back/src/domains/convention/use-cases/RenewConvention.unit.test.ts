import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  BadRequestError,
  ConnectedUserBuilder,
  type ConventionDomainJwtPayload,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionRelatedJwtPayload,
  type ConventionRole,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  ForbiddenError,
  type RenewConventionParams,
  ScheduleDtoBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { InMemorySiretGateway } from "../../core/sirene/adapters/InMemorySiretGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { makeAddConvention } from "./AddConvention";
import { makeRenewConvention, type RenewConvention } from "./RenewConvention";

describe("RenewConvention", () => {
  let renewConvention: RenewConvention;
  let uow: InMemoryUnitOfWork;
  let uuidGenerator: TestUuidGenerator;

  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.com")
    .buildUser();
  const agencyAdmin = new ConnectedUserBuilder()
    .withId("agency-admin")
    .withEmail("agency-admin@mail.com")
    .buildUser();
  const backofficeAdmin = new ConnectedUserBuilder()
    .withId("admin")
    .withIsAdmin(true)
    .buildUser();

  const agency = new AgencyDtoBuilder().build();

  const existingValidatedConvention = new ConventionDtoBuilder()
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyId(agency.id)
    .build();

  const renewedConventionStartDate = addDays(
    new Date(existingValidatedConvention.dateEnd),
    1,
  );
  const renewConventionEndDate = addDays(renewedConventionStartDate, 5);

  const renewConventionParams: RenewConventionParams = {
    id: "11111111-1111-4111-9111-111111111111",
    dateStart: renewedConventionStartDate.toISOString(),
    dateEnd: renewConventionEndDate.toISOString(),
    schedule: new ScheduleDtoBuilder()
      .withReasonableScheduleInInterval({
        start: renewedConventionStartDate,
        end: renewConventionEndDate,
      })
      .build(),
    renewed: {
      from: existingValidatedConvention.id,
      justification: "Il faut bien...",
    },
  };

  beforeEach(() => {
    uow = createInMemoryUow();
    const uowPerformer = new InMemoryUowPerformer(uow);
    uuidGenerator = new TestUuidGenerator();
    renewConvention = makeRenewConvention({
      uowPerformer,
      deps: {
        addConvention: makeAddConvention({
          uowPerformer,
          deps: {
            createNewEvent: makeCreateNewEvent({
              timeGateway: new CustomTimeGateway(),
              uuidGenerator,
            }),
            siretGateway: new InMemorySiretGateway(),
          },
        }),
      },
    });
    uow.conventionRepository.setConventions([existingValidatedConvention]);
    uow.userRepository.users = [backofficeAdmin, validator, agencyAdmin];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        [agencyAdmin.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
      }),
    ];
  });

  const createJwtPayload = ({
    conventionId,
    role,
  }: {
    conventionId: ConventionId;
    role: ConventionRole;
  }): ConventionDomainJwtPayload => ({
    applicationId: conventionId,
    role,
    emailHash: "my-hash",
  });

  describe("Happy paths", () => {
    it.each([
      {
        payloadKind: "convention",
        payload: createJwtPayload({
          role: "validator",
          conventionId: existingValidatedConvention.id,
        }),
      },
      {
        payloadKind: "connected user backoffice admin",
        payload: { userId: backofficeAdmin.id },
      },
      {
        payloadKind: "connected user validator",
        payload: {
          userId: validator.id,
        },
      },
    ] satisfies {
      payloadKind: string;
      payload: ConventionRelatedJwtPayload;
    }[])(
      "renews the convention with $payloadKind jwt payload",
      async ({ payload }) => {
        const result = await renewConvention.execute(
          renewConventionParams,
          payload,
        );

        expect(result).toBeUndefined();

        expectToEqual(uow.conventionRepository.conventions, [
          existingValidatedConvention,
          {
            ...existingValidatedConvention,
            ...renewConventionParams,
            signatories: {
              beneficiary: {
                ...existingValidatedConvention.signatories.beneficiary,
                signedAt: undefined,
              },
              establishmentRepresentative: {
                ...existingValidatedConvention.signatories
                  .establishmentRepresentative,
                signedAt: undefined,
              },
            },
            status: "READY_TO_SIGN",
          },
        ]);
      },
    );
  });

  describe("Wrong paths", () => {
    it("throws an error when convention id in params does not match to convention id in JWT payload", async () => {
      await expectPromiseToFailWithError(
        renewConvention.execute(
          renewConventionParams,
          createJwtPayload({
            role: "validator",
            conventionId: "another-convention-id",
          }),
        ),
        new ForbiddenError(
          "This token is not allowed to renew this convention",
        ),
      );
    });

    it("throws an error when convention not found", async () => {
      uow.conventionRepository.setConventions([]);

      await expectPromiseToFailWithError(
        renewConvention.execute(
          renewConventionParams,
          createJwtPayload({
            role: "validator",
            conventionId: existingValidatedConvention.id,
          }),
        ),
        errors.convention.notFound({
          conventionId: existingValidatedConvention.id,
        }),
      );
    });

    it("throws an error when convention is not ACCEPTED_BY_VALIDATOR", async () => {
      const existingNotValidatedConvention = new ConventionDtoBuilder().build();

      uow.conventionRepository.setConventions([existingNotValidatedConvention]);

      await expectPromiseToFailWithError(
        renewConvention.execute(
          renewConventionParams,
          createJwtPayload({
            role: "validator",
            conventionId: existingNotValidatedConvention.id,
          }),
        ),
        new BadRequestError(
          `This convention cannot be renewed, as it has status : '${existingNotValidatedConvention.status}'`,
        ),
      );
    });

    it("throws an error when jwt role has not enough privileges", async () => {
      await expectPromiseToFailWithError(
        renewConvention.execute(
          renewConventionParams,
          createJwtPayload({
            role: "beneficiary",
            conventionId: existingValidatedConvention.id,
          }),
        ),
        new ForbiddenError(
          `The role 'beneficiary' is not allowed to renew convention`,
        ),
      );
    });

    it("throws an error when missing connect user", async () => {
      uow.userRepository.users = [];

      await expectPromiseToFailWithError(
        renewConvention.execute(renewConventionParams, {
          userId: validator.id,
        }),
        errors.user.notFound({ userId: validator.id }),
      );
    });

    it("throws an error when connected user has no rights on agency", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

      await expectPromiseToFailWithError(
        renewConvention.execute(renewConventionParams, {
          userId: validator.id,
        }),
        new ForbiddenError(
          `You don't have sufficient rights on agency '${existingValidatedConvention.agencyId}'.`,
        ),
      );
    });

    it("throws an error when connected user has bad rights on agency", async () => {
      await expectPromiseToFailWithError(
        renewConvention.execute(renewConventionParams, {
          userId: agencyAdmin.id,
        }),
        new ForbiddenError(
          "The role 'agency-admin' is not allowed to renew convention",
        ),
      );
    });
  });
});
