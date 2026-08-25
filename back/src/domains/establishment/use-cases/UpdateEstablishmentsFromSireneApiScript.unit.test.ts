import subDays from "date-fns/subDays";
import { expectToEqual } from "shared";
import { InMemorySiretGateway } from "../../core/sirene/adapters/InMemorySiretGateway";
import type { SiretEstablishmentResponseDto } from "../../core/sirene/ports/SiretGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import {
  makeUpdateEstablishmentsFromSirenApiScript,
  type UpdateEstablishmentsFromSirenApiScript,
} from "./UpdateEstablishmentsFromSirenApiScript";

// This use case is kept as inspiration for when we'll need to update establishments from SIREN API (ours not LBB)

const maxEstablishmentsPerBatch = 1;
const maxEstablishmentsPerFullRun = 2;
const numberOfDaysAgoToCheckForInseeUpdates = 30;
const numberOfDaysToRetrieveInseeUpdates = 120;
const now = new Date("2023-06-16");

describe("Update establishments from Sirene API", () => {
  let updateEstablishmentsScript: UpdateEstablishmentsFromSirenApiScript;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let siretGateway: InMemorySiretGateway;

  beforeEach(() => {
    siretGateway = new InMemorySiretGateway();
    uow = createInMemoryUow();
    const uowPerformer = new InMemoryUowPerformer(uow);
    timeGateway = new CustomTimeGateway();
    timeGateway.setNextDate(now);
    updateEstablishmentsScript = makeUpdateEstablishmentsFromSirenApiScript({
      deps: {
        siretGateway,
        timeGateway,
        uowPerformer,
        numberOfDaysAgoToCheckForInseeUpdates,
        numberOfDaysToRetrieveInseeUpdates,
        maxEstablishmentsPerBatch,
        maxEstablishmentsPerFullRun,
      },
    });
  });

  it("when there is no establishment which needs an update", async () => {
    const establishmentAggregate = makeEstablishmentWithLastInseeCheck(
      "11110000111100",
      subDays(now, 29),
    );
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];

    const report = await updateEstablishmentsScript.execute();

    expectToEqual(report, {
      numberOfEstablishmentsToUpdate: 0,
      establishmentWithNewData: 0,
      callsToInseeApi: 0,
    });
    expectToEqual(
      uow.establishmentAggregateRepository.establishmentAggregates,
      [establishmentAggregate],
    );
  });

  describe("when there is an establishment which needs an update", () => {
    describe("when insee returns no update", () => {
      it("establishment has never been updated with insee data", async () => {
        const establishmentAggregate = makeEstablishmentWithLastInseeCheck(
          "11110000111100",
          undefined,
        );
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentAggregate,
        ];
        siretGateway.siretEstablishmentsUpdateSince = [];

        const report = await updateEstablishmentsScript.execute();

        expectToEqual(report, {
          numberOfEstablishmentsToUpdate: 1,
          establishmentWithNewData: 0,
          callsToInseeApi: 1,
        });
        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            makeEstablishmentWithLastInseeCheck(
              establishmentAggregate.establishment.siret,
              now,
            ),
          ],
        );
      });

      it("establishment has been updated with insee data long ago", async () => {
        const establishmentAggregate = makeEstablishmentWithLastInseeCheck(
          "11110000111100",
          subDays(now, 31),
        );
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentAggregate,
        ];
        siretGateway.siretEstablishmentsUpdateSince = [];

        const report = await updateEstablishmentsScript.execute();

        expectToEqual(report, {
          numberOfEstablishmentsToUpdate: 1,
          establishmentWithNewData: 0,
          callsToInseeApi: 1,
        });
        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            makeEstablishmentWithLastInseeCheck(
              establishmentAggregate.establishment.siret,
              now,
            ),
          ],
        );
      });
    });

    describe("When insee returns updated data", () => {
      it("establishment has been updated with insee data long ago", async () => {
        const establishmentSiret = "11110000111100";

        const initialEstablishmentAggregate =
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(establishmentSiret)
                .withLastInseeCheck(subDays(now, 31))
                .withNafDto({ code: "999", nomenclature: "Old" })
                .withName("My old Business")
                .withCustomizedName("This is my custom name")
                .withIsOpen(true)

                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "",
                phone: "",
                userId: "osef",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          initialEstablishmentAggregate,
        ];
        const siretEstablishmentDto = {
          siret: establishmentSiret,
          isOpen: false,
          numberEmployeesRange: "10-19",
          businessName: "My updated Business",
          nafDto: { code: "123", nomenclature: "Yo" },
          businessAddress: "Address which should not be updated",
        } satisfies SiretEstablishmentResponseDto;
        siretGateway.siretEstablishmentsUpdateSince = [siretEstablishmentDto];

        const report = await updateEstablishmentsScript.execute();

        expectToEqual(report, {
          numberOfEstablishmentsToUpdate: 1,
          establishmentWithNewData: 1,
          callsToInseeApi: 1,
        });
        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(initialEstablishmentAggregate)
              .withEstablishment(
                new EstablishmentEntityBuilder(
                  initialEstablishmentAggregate.establishment,
                )
                  .withIsOpen(siretEstablishmentDto.isOpen)
                  .withName(siretEstablishmentDto.businessName)
                  .withNafDto(siretEstablishmentDto.nafDto)
                  .withNumberOfEmployeeRange(
                    siretEstablishmentDto.numberEmployeesRange,
                  )
                  .withLastInseeCheck(now)
                  .build(),
              )
              .build(),
          ],
        );
      });

      it("updates only number of establishment up to the maximum provided", async () => {
        const establishmentSiret = "11110000111100";

        const initialEstablishmentAggregate =
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(establishmentSiret)
                .withLastInseeCheck(subDays(now, 31))
                .withNafDto({ code: "999", nomenclature: "Old" })
                .withName("My old Business")
                .withCustomizedName("This is my custom name")
                .withIsOpen(true)

                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "",
                phone: "",
                userId: "osef",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build();

        const establishmentSiret2 = "22220000222200";

        const initialEstablishmentAggregate2 =
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(establishmentSiret2)
                .withLastInseeCheck(subDays(now, 31))
                .withNafDto({ code: "999", nomenclature: "Old" })
                .withName("My old Business")
                .withCustomizedName("This is my custom name")
                .withIsOpen(true)

                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "",
                phone: "",
                userId: "osef",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build();

        const establishmentSiret3 = "33330000333300";

        const initialEstablishmentAggregate3 =
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(establishmentSiret3)
                .withLastInseeCheck(subDays(now, 31))
                .withNafDto({ code: "999", nomenclature: "Old" })
                .withName("My old Business")
                .withCustomizedName("This is my custom name")
                .withIsOpen(true)

                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "",
                phone: "",
                userId: "osef",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          initialEstablishmentAggregate,
          initialEstablishmentAggregate2,
          initialEstablishmentAggregate3,
        ];

        const siretEstablishmentDto = {
          siret: establishmentSiret,
          isOpen: false,
          numberEmployeesRange: "10-19",
          businessName: "My updated Business",
          nafDto: { code: "123", nomenclature: "Yo" },
          businessAddress: "Address which should not be updated",
        } satisfies SiretEstablishmentResponseDto;
        siretGateway.siretEstablishmentsUpdateSince = [
          siretEstablishmentDto,
          { ...siretEstablishmentDto, siret: establishmentSiret2 },
        ];

        const report = await updateEstablishmentsScript.execute();

        expectToEqual(report, {
          numberOfEstablishmentsToUpdate: 2,
          establishmentWithNewData: 2,
          callsToInseeApi: 2,
        });

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(initialEstablishmentAggregate)
              .withEstablishment(
                new EstablishmentEntityBuilder(
                  initialEstablishmentAggregate.establishment,
                )
                  .withIsOpen(siretEstablishmentDto.isOpen)
                  .withName(siretEstablishmentDto.businessName)
                  .withNafDto(siretEstablishmentDto.nafDto)
                  .withNumberOfEmployeeRange(
                    siretEstablishmentDto.numberEmployeesRange,
                  )
                  .withLastInseeCheck(now)
                  .build(),
              )
              .build(),
            new EstablishmentAggregateBuilder(initialEstablishmentAggregate2)
              .withEstablishment(
                new EstablishmentEntityBuilder(
                  initialEstablishmentAggregate2.establishment,
                )
                  .withIsOpen(siretEstablishmentDto.isOpen)
                  .withName(siretEstablishmentDto.businessName)
                  .withNafDto(siretEstablishmentDto.nafDto)
                  .withNumberOfEmployeeRange(
                    siretEstablishmentDto.numberEmployeesRange,
                  )
                  .withLastInseeCheck(now)
                  .build(),
              )
              .build(),
            initialEstablishmentAggregate3,
          ],
        );
      });
    });
  });
});

const makeEstablishmentWithLastInseeCheck = (
  siret: string,
  lastInseeCheck: Date | undefined,
) =>
  new EstablishmentAggregateBuilder()
    .withEstablishment(
      new EstablishmentEntityBuilder()
        .withSiret(siret)
        .withLastInseeCheck(lastInseeCheck)
        .build(),
    )
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "",
        phone: "",
        userId: "osef",
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
    ])
    .build();
