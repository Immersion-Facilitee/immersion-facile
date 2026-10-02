// Matches valid dates of the format 'yyyy-mm-dd'.
import {
  addDays,
  addHours,
  addYears,
  differenceInCalendarDays,
  isValid,
  subHours,
  subYears,
} from "date-fns";
import { z } from "zod";
import type { Flavor } from "../typeFlavors";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import { zStringMinLength1Max1024 } from "./string.schema";

export type DateString = Flavor<string, "DateString">;

export const makeDateStringSchema: (
  errorMessage?: string,
) => ZodSchemaWithInputMatchingOutput<DateString> = (errorMessage) =>
  zStringMinLength1Max1024.superRefine((dateString, ctx) => {
    if (!dateString.match(dateRegExp))
      return ctx.addIssue({
        code: "custom",
        message: errorMessage ?? localization.invalidDate,
      });

    const date = new Date(dateString);

    if (!Number.isFinite(+date))
      return ctx.addIssue({
        code: "custom",
        message: errorMessage ?? localization.invalidDate,
      });

    const now = new Date();
    if (
      !isInRange(
        {
          from: subYears(now, 130),
          to: addYears(now, 5),
        },
        date,
      )
    )
      return ctx.addIssue({
        code: "custom",
        message: localization.unsupportedDate,
      });
  });

export type DateTimeIsoString = Flavor<string, "DateTimeIsoString">;

export type DateRange = {
  from: Date;
  to: Date;
};
export type OptionalDateRange = Partial<DateRange>;
export const isInRange = (
  { from, to }: Partial<DateRange>,
  date: Date,
): boolean => {
  const fromCondition = from ? date >= from : true;
  const toCondition = to ? date <= to : true;

  return fromCondition && toCondition;
};

export const withDateRangeSchema: ZodSchemaWithInputMatchingOutput<DateRange> =
  z
    .object({
      from: z.date(),
      to: z.date(),
    })
    .refine(
      ({ from, to }) => from < to,
      "La date de fin doit être après la date de début.",
    );

export const relativeTimeFormat = new Intl.RelativeTimeFormat("fr", {
  numeric: "auto",
});

const hourDisplayedSeparator = "h";

export const dateTimeIsoStringSchema: z.ZodISODateTime = z.iso.datetime({
  error: localization.invalidDate,
});

export const dateRegExp = /\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])/;

export const toDateUTCString = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid time value");
  }
  return date.toISOString().split("T")[0];
};

const isWinterClockHours = (date: Date): boolean => {
  const year = date.getUTCFullYear();

  const lastDayMarch = new Date(Date.UTC(year, 2, 31));
  const lastSundayMarch = new Date(
    Date.UTC(year, 2, 31 - lastDayMarch.getUTCDay()),
  );

  const lastDayOctober = new Date(Date.UTC(year, 9, 31));
  const lastSundayOctober = new Date(
    Date.UTC(year, 9, 31 - lastDayOctober.getUTCDay()),
  );

  return date < lastSundayMarch || date >= lastSundayOctober;
};

const getParisTotalHours = (date: Date): number => {
  const parisOffset = isWinterClockHours(date) ? 1 : 2;
  return date.getUTCHours() + parisOffset;
};

export const toDisplayedParisTime = ({ date }: { date: Date }): string => {
  const hours = String(getParisTotalHours(date) % 24).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hours}${hourDisplayedSeparator}${minutes} (heure de Paris)`;
};

export const toDisplayedDate = ({
  date,
  withHours = false,
}:
  | { date: Date; withHours?: false }
  | { date: Date; withHours?: true }): string => {
  if (withHours) {
    const dateForDisplay =
      getParisTotalHours(date) >= 24 ? addDays(date, 1) : date;
    const [year, month, day] = toDateUTCString(dateForDisplay).split("-");

    return `${day}/${month}/${year} à ${toDisplayedParisTime({ date })}`;
  }

  const [year, month, day] = toDateUTCString(date).split("-");
  return `${day}/${month}/${year}`;
};

export const isStringDate = (string: string) => isValid(new Date(string));

export const convertLocaleDateToUtcTimezoneDate = (date: Date): Date => {
  if (date.getTimezoneOffset() < 0) return date; // if browser's timezone is ahead of UTC, return the date as is
  return addHours(date, date.getTimezoneOffset() / 60);
};

export const hoursValueToHoursDisplayed = ({
  hoursValue,
  padWithZero = true,
}: {
  hoursValue: number;
  padWithZero?: boolean;
}): string => {
  const hours = Math.floor(hoursValue);
  const minutes = Math.round((hoursValue - hours) * 60);
  const hoursDisplayed = `${hours < 10 && padWithZero ? `0${hours}` : hours}`;
  if (minutes === 0) return `${hoursDisplayed}${hourDisplayedSeparator}`;
  return `${hoursDisplayed}${hourDisplayedSeparator}${
    minutes < 10 ? `0${minutes}` : minutes
  }`;
};

export const getDaysBetween = (from: Date, to: Date) =>
  differenceInCalendarDays(
    convertLocaleDateToUtcTimezoneDate(to),
    convertLocaleDateToUtcTimezoneDate(from),
  );

export const CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS = 24;

export const isWithinHoursCooldown = ({
  lastActionAt,
  minHours,
  now,
}: {
  lastActionAt: Date;
  minHours: number;
  now: Date;
}): boolean => lastActionAt > subHours(now, minHours);

export const formatHoursCooldownTimeRemaining = ({
  lastActionAt,
  minHours,
  now,
}: {
  lastActionAt: Date;
  minHours: number;
  now: Date;
}): string => {
  const nextAllowedTime = addHours(lastActionAt, minHours);
  const timeRemainingMs = nextAllowedTime.getTime() - now.getTime();
  const totalMinutesRemaining = Math.max(
    0,
    Math.ceil(timeRemainingMs / (1000 * 60)),
  );
  const hoursRemaining = Math.floor(totalMinutesRemaining / 60);
  const minutesRemaining = totalMinutesRemaining % 60;

  return `${hoursRemaining}h${minutesRemaining.toString().padStart(2, "0")}`;
};
