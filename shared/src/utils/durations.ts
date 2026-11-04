import { type Duration, formatDuration, intervalToDuration } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import type { ExtractFromExisting } from "../utils";

export const oneMinuteInSeconds = 60;
export const oneHourInSeconds = 60 * oneMinuteInSeconds;
export const oneDayInSecond = oneHourInSeconds * 24;
export const ONE_SECOND_MS = 1_000;
export const OTP_CHALLENGE_DURATION_IN_MINUTES = 30;

export const loginByEmailLinkDurationInMinutes = 15;

type DurationFormat = ExtractFromExisting<
  keyof Duration,
  "minutes" | "hours" | "days"
>;

export const displayDuration = ({
  durationInSeconds,
  format,
}: {
  durationInSeconds: number;
  format: DurationFormat;
}): string =>
  formatDuration(
    intervalToDuration({ start: 0, end: durationInSeconds * 1000 }),
    {
      format: [format],
      locale: frLocale,
    },
  );
