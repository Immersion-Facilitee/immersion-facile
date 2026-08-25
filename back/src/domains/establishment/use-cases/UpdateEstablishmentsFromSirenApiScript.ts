import subDays from "date-fns/subDays";
import { keys } from "ramda";
import type { SiretDto, SiretEstablishmentDto } from "shared";
import type { SiretGateway } from "../../core/sirene/ports/SiretGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import type { UnitOfWorkPerformer } from "../../core/unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type {
  UpdateEstablishmentsWithInseeDataParams,
  ValuesToUpdateFromInseeApi,
} from "../ports/EstablishmentAggregateRepository";

type Report = {
  numberOfEstablishmentsToUpdate: number;
  establishmentWithNewData: number;
  callsToInseeApi: number;
};

type BatchReport = {
  numberOfEstablishmentsToUpdateInBatch: number;
  establishmentWithNewDataInBatch: number;
};

//TODO : usecase name mismatch with filename

export type UpdateEstablishmentsFromSirenApiScript = ReturnType<
  typeof makeUpdateEstablishmentsFromSirenApiScript
>;

type Deps = {
  uowPerformer: UnitOfWorkPerformer;
  siretGateway: SiretGateway;
  timeGateway: TimeGateway;
  numberOfDaysAgoToCheckForInseeUpdates: number;
  numberOfDaysToRetrieveInseeUpdates: number;
  maxEstablishmentsPerBatch: number;
  maxEstablishmentsPerFullRun: number;
};

export const makeUpdateEstablishmentsFromSirenApiScript = useCaseBuilder(
  "UpdateEstablishmentsFromSirenApiScript",
)
  .notTransactional()
  .withOutput<Report>()
  .withDeps<Deps>()
  .build(async ({ deps }) => {
    let callsToInseeApi = 0;
    const now = deps.timeGateway.now();
    const sinceLastCheck = subDays(
      now,
      deps.numberOfDaysAgoToCheckForInseeUpdates,
    );
    const sinceInseeUpdates = subDays(
      now,
      deps.numberOfDaysToRetrieveInseeUpdates,
    );

    let offset = 0;
    let numberOfEstablishmentsToUpdate = 0;
    let establishmentWithNewData = 0;

    while (deps.maxEstablishmentsPerFullRun > offset) {
      const {
        numberOfEstablishmentsToUpdateInBatch,
        establishmentWithNewDataInBatch,
        isInseeApiCalled: isCallToInseeApi,
      } = await processOneBatch(deps, now, sinceLastCheck, sinceInseeUpdates);

      if (isCallToInseeApi) callsToInseeApi++;

      numberOfEstablishmentsToUpdate += numberOfEstablishmentsToUpdateInBatch;
      establishmentWithNewData += establishmentWithNewDataInBatch;

      const areThereMoreEstablishmentsToUpdate =
        numberOfEstablishmentsToUpdateInBatch ===
        deps.maxEstablishmentsPerBatch;

      offset = areThereMoreEstablishmentsToUpdate
        ? offset + deps.maxEstablishmentsPerBatch
        : deps.maxEstablishmentsPerFullRun;
    }

    return {
      numberOfEstablishmentsToUpdate,
      establishmentWithNewData,
      callsToInseeApi,
    };
  });

const processOneBatch = async (
  deps: Deps,
  now: Date,
  sinceLastCheck: Date,
  sinceInseeUpdates: Date,
): Promise<BatchReport & { isInseeApiCalled: boolean }> => {
  const establishmentSiretsToUpdate: SiretDto[] =
    await deps.uowPerformer.perform(async (uow: UnitOfWork) =>
      uow.establishmentAggregateRepository.getSiretsOfEstablishmentsNotCheckedAtInseeSince(
        sinceLastCheck,
        deps.maxEstablishmentsPerBatch,
      ),
    );

  const siretEstablishmentToValuesToUpdateInEstablishment = (
    params: Partial<SiretEstablishmentDto> | undefined,
  ): Partial<ValuesToUpdateFromInseeApi> => ({
    ...(params?.nafDto !== undefined ? { nafDto: params.nafDto } : {}),
    ...(params?.businessName !== undefined
      ? { name: params.businessName }
      : {}),
    ...(params?.isOpen !== undefined ? { isOpen: params.isOpen } : {}),
    ...(params?.numberEmployeesRange !== undefined
      ? { numberEmployeesRange: params.numberEmployeesRange }
      : {}),
  });

  const siretEstablishmentsWithChanges =
    establishmentSiretsToUpdate.length > 0
      ? await deps.siretGateway.getEstablishmentUpdatedBetween(
          sinceInseeUpdates,
          now,
          establishmentSiretsToUpdate,
        )
      : null;

  const paramsToUpdate: UpdateEstablishmentsWithInseeDataParams =
    establishmentSiretsToUpdate.reduce(
      (acc, siret): UpdateEstablishmentsWithInseeDataParams => ({
        ...acc,
        [siret]: siretEstablishmentToValuesToUpdateInEstablishment(
          siretEstablishmentsWithChanges
            ? siretEstablishmentsWithChanges[siret]
            : undefined,
        ),
      }),
      {} satisfies UpdateEstablishmentsWithInseeDataParams,
    );

  await deps.uowPerformer.perform(async (uow: UnitOfWork) =>
    uow.establishmentAggregateRepository.updateEstablishmentsWithInseeData(
      now,
      paramsToUpdate,
    ),
  );

  return {
    numberOfEstablishmentsToUpdateInBatch: establishmentSiretsToUpdate.length,
    establishmentWithNewDataInBatch: siretEstablishmentsWithChanges
      ? keys(siretEstablishmentsWithChanges).length
      : 0,
    isInseeApiCalled: Boolean(siretEstablishmentsWithChanges),
  };
};
