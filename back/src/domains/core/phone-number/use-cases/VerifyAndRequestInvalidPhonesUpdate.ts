import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js/max";
import { partition } from "ramda";
import {
  allDefaultPhoneNumbers,
  defaultPhoneNumber,
  getSupportedCountryCodesForCountry,
  type Phone,
  phoneStatus,
} from "shared";
import z from "zod";
import type { TriggeredBy } from "../../events/events";
import type { CreateNewEvent } from "../../events/ports/EventBus";
import type { TimeGateway } from "../../time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { UpdatePhonePayload } from "./UpdateInvalidPhone";

export const phoneSchema: z.ZodType<Phone> = z.object({
  id: z.number(),
  phoneNumber: z.string(),
  verifiedAt: z.date().nullable(),
  status: z.enum(phoneStatus),
});

export type VerifyAndRequestInvalidPhonesUpdateReport = {
  nbOfCorrectPhones: number;
  nbOfFixedPhones: number;
  nbOfPhonesSetToDefault: number;
};

export type VerifyAndRequestInvalidPhonesUpdate = ReturnType<
  typeof makeVerifyAndRequestInvalidPhonesUpdate
>;

export const makeVerifyAndRequestInvalidPhonesUpdate = useCaseBuilder(
  "VerifyAndRequestInvalidPhonesUpdate",
)
  .withDeps<{
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
    uowPerformer: UnitOfWorkPerformer;
  }>()
  .withInput(
    z.object({
      dateToVerifyBefore: z.date(),
      batchSize: z.number().int().positive(),
    }),
  )
  .withOutput<VerifyAndRequestInvalidPhonesUpdateReport>()
  .notTransactional()
  .build(
    async ({
      deps: { timeGateway, createNewEvent, uowPerformer },
      inputParams: { dateToVerifyBefore, batchSize },
    }) => {
      const triggeredUseCaseDate = timeGateway.now();
      const report: VerifyAndRequestInvalidPhonesUpdateReport = {
        nbOfCorrectPhones: 0,
        nbOfFixedPhones: 0,
        nbOfPhonesSetToDefault: 0,
      };
      let hasMore = true;

      while (hasMore) {
        const batchReport = await uowPerformer.perform(async (uow) => {
          const { phones: phoneNumbersToVerify } =
            await uow.phoneRepository.getPhones({
              limit: batchSize,
              verifiedBefore: dateToVerifyBefore,
            });

          const verifiedPhoneNumbers: {
            updatePhonePayload: UpdatePhonePayload;
            isValid: boolean;
          }[] = phoneNumbersToVerify.map((pn) => {
            const triggeredBy = { kind: "crawler" } satisfies TriggeredBy;

            const isValid = isValidPhoneNumber(pn.phoneNumber);

            if (isValid) {
              return {
                updatePhonePayload: {
                  phoneIdToUpdate: pn.id,
                  newPhoneNumber: pn.phoneNumber,
                  triggeredBy,
                },
                isValid,
              } satisfies {
                updatePhonePayload: UpdatePhonePayload;
                isValid: boolean;
              };
            }

            const resolvedPhone = fixPhoneNumberCountryCode(pn.phoneNumber);
            const updatePhonePayload: UpdatePhonePayload = {
              phoneIdToUpdate: pn.id,
              newPhoneNumber: resolvedPhone ?? defaultPhoneNumber,
              triggeredBy,
            };
            return {
              updatePhonePayload,
              isValid,
            };
          });

          const [validPhoneList, invalidPhoneList] = partition(
            ({ isValid }) => isValid,
            verifiedPhoneNumbers,
          );

          const invalidPhonesToUpdateEvents = invalidPhoneList.map(
            ({ updatePhonePayload }) =>
              createNewEvent({
                topic: "InvalidPhoneUpdateRequested",
                payload: updatePhonePayload,
                wasQuarantined: false,
                priority: 9,
              }),
          );
          await uow.outboxRepository.saveNewEventsBatch(
            invalidPhonesToUpdateEvents,
          );

          await uow.phoneRepository.markAsVerified({
            phoneIds: verifiedPhoneNumbers.map(
              (phone) => phone.updatePhonePayload.phoneIdToUpdate,
            ),
            verifiedDate: triggeredUseCaseDate,
          });

          await uow.phoneRepository.updateStatus({
            phoneIds: validPhoneList.map(
              (phone) => phone.updatePhonePayload.phoneIdToUpdate,
            ),
            status: "VALID",
          });

          await uow.phoneRepository.updateStatus({
            phoneIds: invalidPhoneList.map(
              ({ updatePhonePayload }) => updatePhonePayload.phoneIdToUpdate,
            ),
            status: "UPDATE_PENDING",
          });

          const [defaultedPhoneList, fixedPhoneList] = partition(
            ({ updatePhonePayload: { newPhoneNumber } }) =>
              allDefaultPhoneNumbers.includes(newPhoneNumber),
            invalidPhoneList,
          );

          return {
            nbOfCorrectPhones: validPhoneList.length,
            nbOfFixedPhones: fixedPhoneList.length,
            nbOfPhonesSetToDefault: defaultedPhoneList.length,
            batchSize: phoneNumbersToVerify.length,
          };
        });

        report.nbOfCorrectPhones += batchReport.nbOfCorrectPhones;
        report.nbOfFixedPhones += batchReport.nbOfFixedPhones;
        report.nbOfPhonesSetToDefault += batchReport.nbOfPhonesSetToDefault;

        if (batchReport.batchSize < batchSize) {
          hasMore = false;
        }
      }

      return report;
    },
  );

const fixPhoneNumberCountryCode = (phoneNumber: string): string | undefined => {
  const phoneNumberWithoutCountryCode = `0${parsePhoneNumber(phoneNumber).nationalNumber.toString()}`;

  const newCountryCode = getSupportedCountryCodesForCountry("FR").find(
    (countryCode) =>
      isValidPhoneNumber(phoneNumberWithoutCountryCode, countryCode),
  );

  if (!newCountryCode) {
    return undefined;
  }

  const fixedPhoneNumber = parsePhoneNumber(
    phoneNumberWithoutCountryCode,
    newCountryCode,
  ).format("E.164");

  if (!isValidPhoneNumber(fixedPhoneNumber)) {
    return undefined;
  }

  return fixedPhoneNumber;
};
