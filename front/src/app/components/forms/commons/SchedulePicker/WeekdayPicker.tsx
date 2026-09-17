import { fr } from "@codegouvfr/react-dsfr";
import { addDays, differenceInCalendarDays } from "date-fns";
import { uniq } from "ramda";

import {
  arrayFromNumber,
  convertLocaleDateToUtcTimezoneDate,
  type DateIntervalDto,
  frenchDayMapping,
  type InternshipKind,
  maximumCalendarDayByInternshipKind,
  removeAtIndex,
  type SelectedDaysOfTheWeekDto,
  type WeekdayNumber,
} from "shared";
import { useStyles } from "tss-react/dsfr";
import { DayCircle } from "./DayCircle";

type WeekdayPickerProps = {
  name: string;
  onValueChange: (selectedDays: SelectedDaysOfTheWeekDto) => void;
  selectedDays: SelectedDaysOfTheWeekDto;
  disabled?: boolean;
  interval: DateIntervalDto;
  availableWeekDays: Array<string>;
  internshipKind: InternshipKind;
};

const isDayDisabled = (
  day: WeekdayNumber,
  { start, end }: DateIntervalDto,
  internshipKind: InternshipKind,
) => {
  const startEndDiff = differenceInCalendarDays(end, start);
  if (startEndDiff > maximumCalendarDayByInternshipKind[internshipKind])
    return false;
  const uniqueWeekDaysOnInterval = uniq(
    arrayFromNumber(startEndDiff + 1).map(
      (dayIndex) =>
        frenchDayMapping(
          addDays(
            convertLocaleDateToUtcTimezoneDate(new Date(start)),
            dayIndex,
          ).toISOString(),
        ).frenchDay,
    ),
  );
  return !uniqueWeekDaysOnInterval.includes(day);
};

export const WeekdayPicker = ({
  onValueChange,
  availableWeekDays,
  selectedDays,
  interval,
  internshipKind,
}: WeekdayPickerProps) => {
  const { cx } = useStyles();
  const onDayClick = (day: WeekdayNumber) => {
    const newDaysSelected = selectedDays.includes(day)
      ? removeAtIndex(selectedDays, selectedDays.indexOf(day))
      : [...selectedDays, day];
    onValueChange(newDaysSelected);
  };

  return (
    <div className={cx("schedule-picker__section")}>
      <div
        className={cx(
          fr.cx("fr-grid-row", "fr-mb-2w"),
          "schedule-picker",
          "schedule-picker--regular",
        )}
      >
        {availableWeekDays.map((dayName, index) => {
          if (!isWeekDayNumber(index)) return null;
          return (
            <DayCircle
              // biome-ignore lint/suspicious/noArrayIndexKey: Index is ok here
              key={dayName + index}
              name={dayName}
              disabled={isDayDisabled(index, interval, internshipKind)}
              dayStatus={selectedDays.includes(index) ? "hasTime" : "empty"}
              onClick={() => onDayClick(index)}
            />
          );
        })}
      </div>
    </div>
  );
};

const isWeekDayNumber = (value: number): value is WeekdayNumber =>
  value >= 0 && value <= 6;
