import { fr } from "@codegouvfr/react-dsfr";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";

import { useFormContext } from "react-hook-form";
import {
  type ConventionDto,
  type ConventionReadDto,
  type DateIntervalDto,
  reasonableSchedule,
  scheduleWithFirstDayActivity,
  type Weekday,
} from "shared";
import { ComplexSchedulePicker } from "./ComplexSchedulePicker";
import { RegularSchedulePicker } from "./RegularSchedulePicker";
import "./SchedulePicker.css";

type SchedulePickerProps = {
  disabled?: boolean;
  interval: DateIntervalDto;
  excludedDays: Weekday[];
};

export const SchedulePicker = ({
  interval,
  disabled,
  excludedDays,
}: SchedulePickerProps): JSX.Element => {
  const name: keyof ConventionDto = "schedule";
  const {
    setValue,
    formState: { errors },
    watch,
  } = useFormContext<ConventionReadDto>();
  const values = watch();
  const onBoolRadioPickerChange = (isSimple: boolean): void => {
    const newScheduleValue = isSimple
      ? reasonableSchedule(interval, excludedDays, [])
      : scheduleWithFirstDayActivity(interval, excludedDays);
    setValue(name, newScheduleValue);
  };
  const error = errors[name];
  const scheduleErrors = error?.message
    ? toArrayOfScheduleErrors(error.message)
    : [];
  return (
    <>
      <RadioButtons
        legend="Les horaires quotidiens sont-ils réguliers ? *"
        hintText="Ex : (Non) chaque jour a des horaires bien spécifiques, (Oui) “Du lundi au vendredi de 8h00 à 17h00”"
        options={[
          {
            label: "Oui",
            nativeInputProps: {
              onChange: () => onBoolRadioPickerChange(true),
              checked: values.schedule.isSimple,
            },
          },
          {
            label: "Non, irréguliers",
            nativeInputProps: {
              checked: !values.schedule.isSimple,
              onChange: () => onBoolRadioPickerChange(false),
            },
          },
        ]}
        disabled={disabled}
      />

      <p className={fr.cx("fr-h4", "fr-mt-4w")}>
        {values[name].isSimple
          ? "Sélectionnez les jours travaillés *"
          : "Sélectionnez les horaires de travail jour par jour *"}
      </p>
      {scheduleErrors.map((value, index) => (
        <div
          id={`${name}${index + 1}-error-description`}
          className={fr.cx("fr-error-text", "fr-mb-2w")}
          key={`error-${value}`}
        >
          {value}
        </div>
      ))}
      <div>
        <p className={fr.cx("fr-sr-only")}>
          La saisie de l'emploi du temps n'est pas accessible aux technologies
          d’assistance.
        </p>
        {values[name].isSimple ? (
          <RegularSchedulePicker interval={interval} disabled={disabled} />
        ) : (
          <ComplexSchedulePicker disabled={disabled} />
        )}
      </div>
    </>
  );
};

const toArrayOfScheduleErrors = (input: string): string[] => {
  try {
    const json = JSON.parse(input);
    return Array.isArray(json)
      ? json
      : Object.entries(json).map(([_key, value]) => `${value}`);
  } catch (_e) {
    return typeof input === "object"
      ? Object.entries(input).map(([_key, value]) => `${value}`)
      : [input];
  }
};
