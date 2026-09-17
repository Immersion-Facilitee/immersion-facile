import {
  addDays,
  addHours,
  differenceInDays,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { clone, prop, uniq } from "ramda";
import {
  IMMERSION_WEEKLY_LIMITED_SCHEDULE_HOURS,
  type RenewConventionParams,
} from "../convention/convention.dto";
import { isConventionOld } from "../convention/convention.schema";
import { arrayFromNumber } from "../utils";
import {
  convertLocaleDateToUtcTimezoneDate,
  type DateString,
} from "../utils/date";
import {
  type DailyScheduleDto,
  type DateIntervalDto,
  type ScheduleDto,
  type SelectedDaysOfTheWeekDto,
  type TimePeriodDto,
  type TimePeriodsDto,
  type Weekday,
  type WeekdayNumber,
  weekdays,
} from "./Schedule.dto";

export type DailyImmersionTimetableDto = {
  timePeriods: TimePeriodsDto | null;
  date: DateString;
};

export type WeeklyImmersionTimetableDto = DailyImmersionTimetableDto[];

type ImmersionTimeTable = WeeklyImmersionTimetableDto[];

type UniversalDayMappingToFrenchCalendar = {
  universalDay: WeekdayNumber;
  frenchDay: WeekdayNumber;
  frenchDayName: Weekday;
};

const dayOfWeekMapping: UniversalDayMappingToFrenchCalendar[] = [
  { frenchDayName: "lundi", frenchDay: 0, universalDay: 1 },
  { frenchDayName: "mardi", frenchDay: 1, universalDay: 2 },
  { frenchDayName: "mercredi", frenchDay: 2, universalDay: 3 },
  { frenchDayName: "jeudi", frenchDay: 3, universalDay: 4 },
  { frenchDayName: "vendredi", frenchDay: 4, universalDay: 5 },
  { frenchDayName: "samedi", frenchDay: 5, universalDay: 6 },
  { frenchDayName: "dimanche", frenchDay: 6, universalDay: 0 },
];

type DatesOfImmersion = {
  dateStart: string;
  dateEnd: string;
};

type WeeklySchedule = {
  schedule: string[];
  period: DateIntervalDto;
  weeklyHours: number;
}[];

export const calculateTotalImmersionHoursFromComplexSchedule = (
  complexSchedule: DailyScheduleDto[],
): number => {
  const dates = complexSchedule.map(prop("date"));
  const dateStart = dates.sort()[0];
  const dateEnd = dates.reverse()[0];
  return calculateTotalImmersionHoursBetweenDateComplex({
    complexSchedule,
    dateStart,
    dateEnd,
  });
};

export const prettyPrintSchedule = (
  schedule: ScheduleDto,
  interval: DateIntervalDto,
  displayFreeDays = true,
): string =>
  makeImmersionTimetable(schedule.complexSchedule, interval)
    .map((week, weekIndex, weeks) => removeEmptyDays(weekIndex, weeks, week))
    .flatMap((week) => makeWeeklyPrettyPrint(week, displayFreeDays, interval))
    .join("\n");

export const makeWeeklySchedule = (
  schedule: ScheduleDto,
  interval: DateIntervalDto,
): WeeklySchedule => {
  const immersionTimetable = makeImmersionTimetable(
    schedule.complexSchedule,
    interval,
  ).filter((weekSchedule) => !!weekSchedule);

  return immersionTimetable.map((weekSchedule, weekIndex) => {
    const isStartingWeek = weekIndex === 0;
    const isEndingWeek = weekIndex === immersionTimetable.length - 1;
    const weekStart = weekSchedule[0]?.date;
    const weekEnd = weekSchedule[weekSchedule.length - 1]?.date;
    if (!weekStart || !weekEnd)
      throw new Error("Error: schedule should have a weekStart and weekEnd");
    const weeklyHours = calculateWeeklyHours(weekSchedule);

    return {
      weeklyHours,
      period: {
        start: isStartingWeek ? interval.start : new Date(weekStart),
        end: isEndingWeek ? interval.end : new Date(weekEnd),
      },
      schedule: weekSchedule
        .filter(
          (daySchedule) =>
            new Date(daySchedule.date) >= interval.start &&
            new Date(daySchedule.date) <= interval.end,
        )
        .map(
          (daySchedule) =>
            `${
              frenchDayMapping(daySchedule.date).frenchDayName
            } : ${prettyPrintDaySchedule(daySchedule.timePeriods)}`,
        ),
    };
  });
};

const reasonableTimePeriods: TimePeriodsDto = [
  {
    start: "08:00",
    end: "12:00",
  },
  {
    start: "13:00",
    end: "16:00",
  },
];

export const isValidInterval = (interval: DateIntervalDto): boolean =>
  !(
    Number.isNaN(interval.start.getTime()) ||
    Number.isNaN(interval.end.getTime())
  );

export const reasonableSchedule = (
  interval: DateIntervalDto,
  excludedDays: Weekday[] = [],
  timePeriods: TimePeriodsDto = reasonableTimePeriods,
): ScheduleDto => {
  const complexSchedule = isValidInterval(interval)
    ? makeComplexSchedule(interval, timePeriods, excludedDays)
    : [];
  return {
    totalHours:
      calculateTotalImmersionHoursFromComplexSchedule(complexSchedule),
    workedDays: calculateNumberOfWorkedDays(complexSchedule),
    isSimple: true,
    complexSchedule,
  };
};

export const frenchDayMapping = (
  originalDate: string,
): UniversalDayMappingToFrenchCalendar => {
  const date = parseISO(originalDate);
  const universalDay = date.getUTCDay();
  const mapping = dayOfWeekMapping.find(
    (value) => value.universalDay === universalDay,
  );
  if (mapping) return mapping;
  throw new Error(
    `Universal day index ${universalDay} of date ${originalDate} missing on dayMapping: ${JSON.stringify(
      dayOfWeekMapping,
    )}`,
  );
};

const minutesInDay = (timePeriods: TimePeriodDto[]): number =>
  timePeriods.reduce(
    (totalMinutes, period) => totalMinutes + timePeriodDurationMinutes(period),
    0,
  );

const periodStringToHoursMinutes = (s: string) => {
  const [hour, minute] = s.split(":").map(Number);
  return [hour, minute];
};

const timePeriodDurationMinutes = (period: TimePeriodDto) => {
  const [startHour, startMinute] = periodStringToHoursMinutes(period.start);
  const [endHour, endMinute] = periodStringToHoursMinutes(period.end);
  return Math.max(0, (endHour - startHour) * 60 + endMinute - startMinute);
};

const isTimePeriodPositive = (period: TimePeriodDto) => {
  const [startHour, startMinute] = periodStringToHoursMinutes(period.start);
  const [endHour, endMinute] = periodStringToHoursMinutes(period.end);
  const duration = (endHour - startHour) * 60 + endMinute - startMinute;
  return duration > 0;
};

const periodStringToMinutesFromMidnight = (s: string) => {
  const [hr, min] = periodStringToHoursMinutes(s);
  return hr * 60 + min;
};

// Returns true if the two periods overlap (for at least one minute).
const isPeriodsOverlap = (
  period1: TimePeriodDto,
  period2: TimePeriodDto,
): boolean => {
  const period1Start = periodStringToMinutesFromMidnight(period1.start);
  const period1End = periodStringToMinutesFromMidnight(period1.end);
  const period2Start = periodStringToMinutesFromMidnight(period2.start);

  // Force ordering
  return period1Start > period2Start
    ? isPeriodsOverlap(period2, period1)
    : period2Start < period1End;
};

// Generates a string in format: "(09:00 - 13:00)"
const periodToHumanReadableString = (period: TimePeriodDto): string =>
  `(${period.start} - ${period.end})`;

export const calculateNumberOfWorkedDays = (
  complexSchedule: DailyScheduleDto[],
): number => complexSchedule.filter((v) => v.timePeriods.length > 0).length;

export const validateSchedule = ({
  schedule,
  dateEnd,
  dateStart,
  id,
}: Omit<RenewConventionParams, "renewed">): string | undefined => {
  if (isConventionOld(dateEnd)) return;
  const conventionIdPrefix = `Convention ${id} - `;
  const totalWeeksHours = calculateWeeklyHoursFromSchedule(schedule, {
    start: new Date(dateStart),
    end: new Date(dateEnd),
  });

  for (const [totalHoursIndex, totalHours] of totalWeeksHours.entries()) {
    if (totalHours > IMMERSION_WEEKLY_LIMITED_SCHEDULE_HOURS)
      return `${conventionIdPrefix}Veuillez saisir moins de ${IMMERSION_WEEKLY_LIMITED_SCHEDULE_HOURS}h pour la semaine ${
        totalHoursIndex + 1
      }.`;
  }

  const totalHoursFromComplexSchedule =
    calculateTotalImmersionHoursFromComplexSchedule(schedule.complexSchedule);

  if (totalHoursFromComplexSchedule !== schedule.totalHours)
    return `${conventionIdPrefix}Le nombre total d'heure ne correspond pas à celui du calendrier. Calcul du calendrier: ${totalHoursFromComplexSchedule}, Nombre total heures fourni: ${schedule.totalHours}`;

  const workedDays = calculateNumberOfWorkedDays(schedule.complexSchedule);
  if (workedDays !== schedule.workedDays)
    return `${conventionIdPrefix}Le nombre total de jours travaillés ne correspond pas à celui du calendrier. Calcul du calendrier: ${workedDays}, Nombre de jours fourni: ${schedule.workedDays}`;

  for (const dailySchedule of schedule.complexSchedule) {
    for (const [periodIndex, period] of dailySchedule.timePeriods.entries()) {
      // Check if all periods are positive.
      if (!isTimePeriodPositive(period))
        return `${conventionIdPrefix}La plage horaire ${
          periodIndex + 1
        } ${periodToHumanReadableString(period)} du ${toFrenchReadableDate(
          dailySchedule.date,
        )} est incorrecte. L'heure de début doit précéder l'heure de fin.`;

      // Check for overlap with other periods
      for (const [
        otherPeriodIndex,
        otherPeriod,
      ] of dailySchedule.timePeriods.entries()) {
        if (
          periodIndex !== otherPeriodIndex &&
          isPeriodsOverlap(period, otherPeriod)
        )
          return `${conventionIdPrefix}Les plages horaires ${
            periodIndex + 1
          } ${periodToHumanReadableString(period)} et ${
            otherPeriodIndex + 1
          } ${periodToHumanReadableString(
            otherPeriod,
          )} du ${toFrenchReadableDate(dailySchedule.date)} se chevauchent.`;
      }
    }
  }
  const totalScheduleHours = totalWeeksHours.reduce((a, b) => a + b, 0);
  if (totalScheduleHours === 0)
    return `${conventionIdPrefix}Veuillez remplir les horaires.`;
};

const toFrenchReadableDate = (isoStringDate: string): string =>
  format(parseISO(isoStringDate), "dd/MM/yyyy");

// Converts an array of TimePeriodDto to a readable schedule, e.g.
// "08:00-12:00, 14:00-17:00". Empty arrays get converted to "libre".
const prettyPrintDaySchedule = (
  timePeriods: TimePeriodDto[] | null,
): string => {
  if (!timePeriods || timePeriods.length === 0) {
    return "libre";
  }
  return timePeriods
    .slice(1)
    .reduce(
      (acc, { start, end }, timePeriodIndex) =>
        timePeriodIndex % 2
          ? `${acc},\n${start}-${end}`
          : `${acc}, ${start}-${end}`,
      `${timePeriods[0].start}-${timePeriods[0].end}`,
    );
};

export const calculateTotalImmersionHoursBetweenDateComplex = ({
  dateStart,
  dateEnd,
  complexSchedule,
}: DatesOfImmersion & {
  complexSchedule: DailyScheduleDto[];
}): number => {
  const start = parseISO(dateStart);
  const end = parseISO(dateEnd);
  let totalOfMinutes = 0;
  for (
    let currentDate = start;
    currentDate < addDays(end, 1);
    currentDate = addDays(currentDate, 1)
  ) {
    const date = complexSchedule.find(
      (dailySchedule) =>
        parseISO(dailySchedule.date).getDate() === currentDate.getDate() &&
        parseISO(dailySchedule.date).getMonth() === currentDate.getMonth() &&
        parseISO(dailySchedule.date).getFullYear() ===
          currentDate.getFullYear(),
    );
    if (date) totalOfMinutes += minutesInDay(date.timePeriods);
  }
  return totalOfMinutes / 60;
};

export const selectedDaysFromComplexSchedule = (
  complexSchedule: DailyScheduleDto[],
): SelectedDaysOfTheWeekDto =>
  uniq(
    complexSchedule
      .filter((day) => day.timePeriods.length > 0)
      .map((day) => frenchDayMapping(day.date).frenchDay),
  ).sort();

const getWeeksSpannedWithoutTimezone = (
  startDate: Date,
  endDate: Date,
): number => {
  const normalizeToUTCMidnight = (date: Date): Date =>
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );

  const getUTCMonday = (date: Date): Date => {
    const normalized = normalizeToUTCMidnight(date);
    const day = normalized.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    normalized.setUTCDate(normalized.getUTCDate() - diffToMonday);
    return normalized;
  };

  const startMonday = getUTCMonday(startDate);
  const endMonday = getUTCMonday(endDate);

  return Math.ceil(differenceInDays(endMonday, startMonday) / 7);
};

export const makeImmersionTimetable = (
  complexSchedule: DailyScheduleDto[],
  { start: startDay, end: endDay }: DateIntervalDto,
): ImmersionTimeTable => {
  const differenceInCalendarWeeksBetweenDates =
    getWeeksSpannedWithoutTimezone(startDay, endDay) + 1;

  return isValidInterval({
    start: startDay,
    end: endDay,
  })
    ? arrayFromNumber(differenceInCalendarWeeksBetweenDates).map(
        (_, weekIndex) =>
          arrayFromNumber(weekdays.length).map((dayIndex) => {
            const mondayOfFirstWeek = subDays(
              startDay,
              frenchDayMapping(startDay.toISOString()).frenchDay,
            );
            const date = addHours(
              mondayOfFirstWeek,
              (dayIndex + weekIndex * weekdays.length) * 24,
            );
            const dailySchedule = complexSchedule.find((dailyScheduleItem) => {
              const schedule = convertLocaleDateToUtcTimezoneDate(
                parseISO(dailyScheduleItem.date),
              );
              return (
                schedule.getUTCDate() === date.getUTCDate() &&
                schedule.getUTCMonth() === date.getUTCMonth() &&
                schedule.getUTCFullYear() === date.getUTCFullYear()
              );
            });
            return {
              timePeriods: dailySchedule?.timePeriods ?? null,
              date: date.toISOString(),
            } satisfies DailyImmersionTimetableDto;
          }),
      )
    : [];
};

// Calculate total hours per week for a given schedule.
export const calculateWeeklyHoursFromSchedule = (
  schedule: ScheduleDto,
  interval: DateIntervalDto,
) =>
  makeImmersionTimetable(schedule.complexSchedule, interval).map(
    calculateWeeklyHours,
  );

export const calculateWeeklyHours = (
  week: WeeklyImmersionTimetableDto,
): number =>
  Number.parseFloat(
    week
      .reduce(
        (previousValue, currentDay) =>
          currentDay.timePeriods
            ? previousValue + minutesInDay(currentDay.timePeriods) / 60
            : previousValue,
        0,
      )
      .toFixed(2),
  );

export const calculateDailyHours = (day: DailyImmersionTimetableDto): number =>
  Number.parseFloat(
    (day.timePeriods ? minutesInDay(day.timePeriods) / 60 : 0).toFixed(2),
  );

export const calculateDailyHoursFromSchedule = (
  schedule: ScheduleDto,
  interval: DateIntervalDto,
): number[] =>
  makeImmersionTimetable(schedule.complexSchedule, interval)
    .flat()
    .map(calculateDailyHours);

export const defaultTimePeriods: TimePeriodsDto = [
  {
    start: "09:00",
    end: "12:00",
  },
  {
    start: "13:00",
    end: "17:00",
  },
];

export const regularTimePeriods = (
  timePeriods: TimePeriodsDto | undefined,
): TimePeriodsDto =>
  timePeriods && timePeriods.length > 0 ? timePeriods : defaultTimePeriods;

export const emptySchedule = (
  interval: DateIntervalDto,
): Readonly<ScheduleDto> => ({
  totalHours: 0,
  workedDays: 0,
  isSimple: false,
  complexSchedule: makeComplexSchedule(interval, []),
});

export const scheduleWithFirstDayActivity = (
  interval: DateIntervalDto,
  excludedDays: Weekday[] = [],
): Readonly<ScheduleDto> => {
  const complexSchedule = makeComplexSchedule(interval, [], excludedDays).map(
    (schedule) => {
      if (schedule.date === interval.start.toISOString()) {
        schedule.timePeriods = [
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ];
      }
      return schedule;
    },
  );
  return {
    totalHours:
      calculateTotalImmersionHoursFromComplexSchedule(complexSchedule),
    workedDays: calculateNumberOfWorkedDays(complexSchedule),
    isSimple: false,
    complexSchedule,
  };
};

export const makeDailySchedule = (
  date: Date,
  schedules: TimePeriodsDto,
): DailyScheduleDto => {
  const timePeriods = clone(schedules);
  return {
    date: date.toISOString(),
    timePeriods,
  };
};

export const makeComplexSchedule = (
  { start, end }: DateIntervalDto,
  timePeriods: TimePeriodsDto,
  excludedDays?: Weekday[],
): DailyScheduleDto[] => {
  const complexSchedules: DailyScheduleDto[] = [];

  const excludedDayNumbers =
    excludedDays?.map(
      (weekday) =>
        dayOfWeekMapping.find((value) => value.frenchDayName === weekday)
          ?.universalDay,
    ) || [];

  for (
    let currentDate = start;
    startOfDay(currentDate) <= startOfDay(end);
    currentDate = addHours(currentDate, 24)
  ) {
    if (!excludedDayNumbers.includes(getDay(currentDate)))
      complexSchedules.push(makeDailySchedule(currentDate, timePeriods));
  }
  return complexSchedules;
};

export const calculateScheduleTotalDurationInDays = (
  complexSchedule: DailyScheduleDto[],
) => {
  const dates = complexSchedule.map(prop("date"));
  const dateStart = dates.sort()[0];
  const dateEnd = dates.reverse()[0];
  return differenceInDays(new Date(dateEnd), new Date(dateStart));
};

export const isSundayInSchedule = (complexSchedule: DailyScheduleDto[]) => {
  const sunday = 0;
  return complexSchedule.some((week) => {
    return (
      convertLocaleDateToUtcTimezoneDate(parseISO(week.date)).getUTCDay() ===
        sunday && week.timePeriods.length > 0
    );
  });
};

const makeWeeklyPrettyPrint = (
  week: DailyImmersionTimetableDto[],
  displayFreeDays: boolean,
  interval: DateIntervalDto,
): string | readonly string[] => [
  `Heures de travail hebdomadaires : ${calculateWeeklyHours(week)}`,
  ...week
    .filter(({ timePeriods, date }) => {
      const shouldRemoveDay = !timePeriods && !displayFreeDays;
      return isWithinInterval(new Date(date), interval) && !shouldRemoveDay;
    })
    .map(
      ({ date, timePeriods }) =>
        `${frenchDayMapping(date).frenchDayName} : ${prettyPrintDaySchedule(
          timePeriods,
        )}`,
    ),
];

const removeEmptyDays = (
  weekIndex: number,
  weeks: WeeklyImmersionTimetableDto[],
  week: WeeklyImmersionTimetableDto,
) => {
  const isStartingWeek = weekIndex === 0;
  const isEndingWeek = weekIndex === weeks.length - 1;
  return week
    .filter((_, index) =>
      isStartingWeek
        ? index >= week.findIndex(({ timePeriods }) => timePeriods !== null)
        : true,
    )
    .filter((_, index) => {
      const lastDayWithoutTimePeriodIndex = week
        .map((otherDay) => otherDay.timePeriods !== null)
        .lastIndexOf(true);
      return isEndingWeek ? index <= lastDayWithoutTimePeriodIndex : true;
    });
};
