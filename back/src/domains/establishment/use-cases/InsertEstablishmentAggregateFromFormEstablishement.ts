import {
  type ConnectedUser,
  type EstablishmentFormOffer,
  errors,
  withFormEstablishmentSchema,
} from "shared";
import { getNafAndNumberOfEmployee } from "../../../utils/siret";
import type { AddressGateway } from "../../core/address/ports/AddressGateway";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import { rejectsSiretIfNotAnOpenCompany } from "../../core/sirene/helpers/rejectsSiretIfNotAnOpenCompany";
import type { SiretGateway } from "../../core/sirene/ports/SiretGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { UuidGenerator } from "../../core/uuid-generator/ports/UuidGenerator";
import { makeEstablishmentAggregate } from "../helpers/makeEstablishmentAggregate";

export type InsertEstablishmentAggregateFromForm = ReturnType<
  typeof makeInsertEstablishmentAggregateFromForm
>;

export const makeInsertEstablishmentAggregateFromForm = useCaseBuilder(
  "InsertEstablishmentAggregateFromForm",
)
  .withInput(withFormEstablishmentSchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{
    siretGateway: SiretGateway;
    addressGateway: AddressGateway;
    uuidGenerator: UuidGenerator;
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
  }>()
  .build(
    async ({
      inputParams: { formEstablishment },
      uow,
      deps: {
        addressGateway,
        createNewEvent,
        siretGateway,
        timeGateway,
        uuidGenerator,
      },
      currentUser,
    }) => {
      if (!currentUser) throw errors.user.noJwtProvided();

      if (
        await uow.bannedEstablishmentRepository.getBannedEstablishmentBySiret(
          formEstablishment.siret,
        )
      ) {
        throw errors.establishment.bannedEstablishment({
          siret: formEstablishment.siret,
        });
      }

      const existingEstablishment =
        await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
          formEstablishment.siret,
        );

      if (existingEstablishment)
        throw errors.establishment.conflictError({
          siret: formEstablishment.siret,
        });

      await rejectsSiretIfNotAnOpenCompany(
        siretGateway,
        formEstablishment.siret,
      );

      const establishmentAggregate = await makeEstablishmentAggregate({
        uow,
        timeGateway,
        addressGateway,
        uuidGenerator,
        score: 0,
        nafAndNumberOfEmployee: await getNafAndNumberOfEmployee(
          siretGateway,
          formEstablishment.siret,
        ),
        formEstablishment: {
          ...formEstablishment,
          offers: await makeValidatedOffers(uow, formEstablishment.offers),
          businessNameCustomized:
            formEstablishment.businessNameCustomized?.trim().length === 0
              ? undefined
              : formEstablishment.businessNameCustomized,
        },
        withBannedEstablishmentInformations: { isEstablishmentBanned: false },
      });

      await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentAggregate,
      );

      await uow.outboxRepository.save(
        createNewEvent({
          topic: "NewEstablishmentAggregateInsertedFromForm",
          payload: {
            establishmentAggregate,
            triggeredBy: {
              kind: "connected-user",
              userId: currentUser.id,
            },
          },
        }),
      );
    },
  );

const makeValidatedOffers = async (
  uow: UnitOfWork,
  offers: EstablishmentFormOffer[],
): Promise<EstablishmentFormOffer[]> => {
  const appellations =
    await uow.romeRepository.getAppellationAndRomeDtosFromAppellationCodesIfExist(
      offers.map(({ appellationCode }) => appellationCode),
    );

  return offers.map(
    ({ appellationCode, remoteWorkMode, immersionActivities }) => {
      const appelationAndRome = appellations.find(
        (appelation) => appelation.appellationCode === appellationCode,
      );
      if (!appelationAndRome)
        throw errors.rome.missingAppellation({ appellationCode });
      return {
        ...appelationAndRome,
        remoteWorkMode,
        immersionActivities,
      };
    },
  );
};
