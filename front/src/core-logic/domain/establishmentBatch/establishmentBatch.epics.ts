import { uniq } from "ramda";
import { filter, map, switchMap } from "rxjs";
import {
  type AbsoluteUrl,
  csvBooleanToBoolean,
  defaultMaxContactsPerMonth,
  type EstablishmentCSVRow,
  type EstablishmentRole,
  establishmentCSVRowSchema,
  establishmentOffersFromCSVToDto,
  type FitForDisableWorkerOption,
  type FormEstablishmentDto,
  type FormEstablishmentSource,
  type FormEstablishmentUserRight,
  formEstablishmentSchema,
  keys,
} from "shared";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { v4 as uuidV4 } from "uuid";
import { z } from "zod";
import {
  establishmentBatchSlice,
  type FormEstablishmentDtoWithErrors,
} from "./establishmentBatch.slice";

type EstablishmentBatchAction = ActionOfSlice<typeof establishmentBatchSlice>;

const candidateEstablishmentParseEpic: AppEpic<EstablishmentBatchAction> = (
  action$,
) =>
  action$.pipe(
    filter(
      establishmentBatchSlice.actions.candidateEstablishmentBatchProvided.match,
    ),
    map((action) => action.payload.map(candidateEstablishmentMapper)),
    map(establishmentBatchSlice.actions.candidateEstablishmentBatchParsed),
  );

const addEstablishmentBatchEpic: AppEpic<EstablishmentBatchAction> = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(
      establishmentBatchSlice.actions.addEstablishmentBatchRequested.match,
    ),
    switchMap((action) =>
      adminGateway
        .addEstablishmentBatch$(
          action.payload.formEstablishmentBatch,
          getConnectedUserJwt(state$.value),
        )
        .pipe(
          map((batchResponse) =>
            establishmentBatchSlice.actions.addEstablishmentBatchSucceeded({
              establishmentBatchReport: batchResponse,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error) =>
            establishmentBatchSlice.actions.addEstablishmentBatchErrored({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const candidateEstablishmentMapper = (
  csvRow: unknown,
): FormEstablishmentDtoWithErrors => {
  let errors: z.ZodIssue[] = [];
  let mappedEstablishment: FormEstablishmentDto | null = null;

  try {
    const establishmentRow = establishmentCSVRowSchema.parse(csvRow);

    const getFitForDisabledWorkers = (): FitForDisableWorkerOption => {
      if (establishmentRow.fitForDisabledWorkers === undefined) return "no";
      if (csvBooleanToBoolean(establishmentRow.fitForDisabledWorkers) === true)
        return "yes-declared-only";
      return "no";
    };

    mappedEstablishment = {
      businessAddresses: [
        {
          id: uuidV4(),
          rawAddress: establishmentRow.businessAddress,
        },
      ],
      businessName: establishmentRow.businessName,
      siret: establishmentRow.siret,
      businessNameCustomized: establishmentRow.businessNameCustomized,
      additionalInformation: establishmentRow.additionalInformation,
      naf: {
        code: establishmentRow.naf_code,
        nomenclature: "NAFRev2",
      },
      website: establishmentRow.website as AbsoluteUrl | "",
      source: "immersion-facile" as FormEstablishmentSource,
      offers: establishmentOffersFromCSVToDto(
        establishmentRow.offers_appellation_code,
      ),
      userRights: makeUserRightsFromCSV(establishmentRow),
      fitForDisabledWorkers: getFitForDisabledWorkers(),
      maxContactsPerMonth: getMaxContactsPerMonth(
        establishmentRow.maxContactPerMonth,
      ),
      searchableBy: {
        jobSeekers: csvBooleanToBoolean(
          establishmentRow.searchableByJobSeekers,
        ),
        students: csvBooleanToBoolean(establishmentRow.searchableByStudents),
      },
      contactMode: establishmentRow.contactMode,
      isEstablishmentBanned: false,
    };
    formEstablishmentSchema.parse(mappedEstablishment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors = error.issues;
    }
  }
  return { formEstablishment: mappedEstablishment, zodErrors: errors };
};

const getMaxContactsPerMonth = (maxContactPerMonth?: string): number => {
  if (maxContactPerMonth === "") return defaultMaxContactsPerMonth;

  const value = Number(maxContactPerMonth);
  return Number.isNaN(value) ? defaultMaxContactsPerMonth : value;
};

export const establishmentBatchEpics = [
  addEstablishmentBatchEpic,
  candidateEstablishmentParseEpic,
];

const makeUserRightsFromCSV = (
  csvRow: EstablishmentCSVRow,
): FormEstablishmentUserRight[] => {
  const otherThanAdminRightsKeys = keys(csvRow).filter(
    (csvRowKey) =>
      csvRowKey.includes("right" as keyof EstablishmentCSVRow) &&
      !csvRowKey.includes("1"),
  );

  const otherThanAdminUserRights = uniq(
    otherThanAdminRightsKeys.map((key) => key.split("_")[0]),
  ).reduce<FormEstablishmentUserRight[]>((acc, current) => {
    const role = csvRow[`${current}_role` as keyof EstablishmentCSVRow] as
      | EstablishmentRole
      | undefined;
    const job = csvRow[`${current}_job` as keyof EstablishmentCSVRow] satisfies
      | string
      | undefined;
    const phone = csvRow[`${current}_phone` as keyof EstablishmentCSVRow];
    const email = csvRow[`${current}_email` as keyof EstablishmentCSVRow];
    return [
      ...acc,
      ...(role && phone && job && email
        ? ([
            {
              role,
              job,
              status: "ACCEPTED",
              phone,
              email,
              shouldReceiveDiscussionNotifications: true,
            },
          ] as FormEstablishmentUserRight[])
        : []),
    ];
  }, []);

  return [
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      email: csvRow.right1_email,
      job: csvRow.right1_job,
      phone: csvRow.right1_phone,
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: true,
    },
    ...otherThanAdminUserRights,
  ];
};
