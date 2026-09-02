import { ZodError, z } from "zod";
import { ConventionDtoBuilder } from "../convention/ConventionDtoBuilder";
import { conventionSchema } from "../convention/convention.schema";
import { expectArraysToEqual, expectToEqual } from "../test.helpers";
import { dateTimeIsoStringSchema } from "../utils/date";
import { localization } from "../zodUtils";
import type {
  DateIntervalDto,
  ScheduleDto,
  SelectedDaysOfTheWeekDto,
} from "./Schedule.dto";
import { scheduleSchema } from "./Schedule.schema";
import { defaultInterval, ScheduleDtoBuilder } from "./ScheduleDtoBuilder";
import {
  calculateNumberOfWorkedDays,
  calculateScheduleTotalDurationInDays,
  calculateTotalImmersionHoursFromComplexSchedule,
  calculateWeeklyHoursFromSchedule,
  isSundayInSchedule,
  makeDailySchedule,
  makeImmersionTimetable,
  makeWeeklySchedule,
  prettyPrintSchedule,
  reasonableSchedule,
  selectedDaysFromComplexSchedule,
} from "./ScheduleUtils";

describe("ScheduleUtils", () => {
  describe("complexScheduleFromRegularSchedule", () => {
    const timePeriods = [{ start: "08:00", end: "10:00" }];

    it("with empty regular schedule and same days", () => {
      const scheduleFromEmptyComplexSchedule = new ScheduleDtoBuilder()
        .withDateInterval({
          start: new Date("2022-06-25"),
          end: new Date("2022-06-26"),
        })
        .withRegularSchedule({
          selectedDays: [5, 6],
          timePeriods,
        })
        .build();

      expect(scheduleFromEmptyComplexSchedule.complexSchedule).toEqual(
        new ScheduleDtoBuilder()
          .withComplexSchedule([
            { date: new Date("2022-06-25").toISOString(), timePeriods },
            { date: new Date("2022-06-26").toISOString(), timePeriods },
          ])
          .build().complexSchedule,
      );
    });

    describe("with updated regular schedule dayPeriods", () => {
      it("initial dayPeriods", () => {
        const scheduleFromEmptyComplexSchedule = new ScheduleDtoBuilder()
          .withDateInterval({
            start: new Date("2022-06-22"),
            end: new Date("2022-07-03"),
          })
          .withRegularSchedule({
            selectedDays: [0, 1],
            timePeriods,
          })
          .build();
        expect(scheduleFromEmptyComplexSchedule.complexSchedule).toEqual(
          new ScheduleDtoBuilder()
            .withComplexSchedule([
              { date: new Date("2022-06-27").toISOString(), timePeriods },
              { date: new Date("2022-06-28").toISOString(), timePeriods },
            ])
            .build().complexSchedule,
        );
      });

      it("updated dayPeriods", () => {
        const scheduleFromEmptyComplexSchedule = new ScheduleDtoBuilder()
          .withDateInterval({
            start: new Date("2022-06-22"),
            end: new Date("2022-07-03"),
          })
          .withRegularSchedule({
            selectedDays: [2, 3],
            timePeriods,
          })
          .build();
        expect(scheduleFromEmptyComplexSchedule.complexSchedule).toEqual(
          new ScheduleDtoBuilder()
            .withComplexSchedule([
              { date: new Date("2022-06-22").toISOString(), timePeriods },
              { date: new Date("2022-06-23").toISOString(), timePeriods },
              { date: new Date("2022-06-29").toISOString(), timePeriods },
              { date: new Date("2022-06-30").toISOString(), timePeriods },
            ])
            .build().complexSchedule,
        );
      });
    });
  });

  describe("prettyPrintSchedule", () => {
    it("prints complex schedules", () => {
      expect(
        prettyPrintSchedule(
          new ScheduleDtoBuilder().withEmptyRegularSchedule().build(),
          defaultInterval,
        ).split("\n"),
      ).toEqual([
        "Heures de travail hebdomadaires : 0",
        "lundi : libre",
        "mardi : libre",
        "mercredi : libre",
        "jeudi : libre",
        "vendredi : libre",
        "samedi : libre",
        "dimanche : libre",
      ]);
      expect(
        prettyPrintSchedule(complexSchedule(), defaultInterval).split("\n"),
      ).toEqual([
        "Heures de travail hebdomadaires : 6",
        "lundi : 01:00-02:00",
        "mardi : libre",
        "mercredi : libre",
        "jeudi : 01:00-02:00, 03:00-04:00",
        "vendredi : libre",
        "samedi : libre",
        "dimanche : 01:00-02:00, 03:00-04:00,",
        "05:00-06:00",
      ]);
    });

    it("prints simple schedules", () => {
      expect(
        prettyPrintSchedule(
          new ScheduleDtoBuilder().withEmptyRegularSchedule().build(),
          defaultInterval,
        ).split("\n"),
      ).toEqual([
        "Heures de travail hebdomadaires : 0",
        "lundi : libre",
        "mardi : libre",
        "mercredi : libre",
        "jeudi : libre",
        "vendredi : libre",
        "samedi : libre",
        "dimanche : libre",
      ]);
      expect(
        prettyPrintSchedule(regularSchedule(), defaultInterval).split("\n"),
      ).toEqual([
        "Heures de travail hebdomadaires : 8",
        "lundi : 01:00-02:00, 03:00-04:00",
        "mardi : libre",
        "mercredi : 01:00-02:00, 03:00-04:00",
        "jeudi : 01:00-02:00, 03:00-04:00",
        "vendredi : libre",
        "samedi : libre",
        "dimanche : 01:00-02:00, 03:00-04:00",
      ]);
    });

    it("remove days before and after interval", () => {
      const interval: DateIntervalDto = {
        start: new Date("2023-08-07"),
        end: new Date("2023-08-12"),
      };

      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withRegularSchedule({
          selectedDays: [2, 4, 5],
          timePeriods: [
            { start: "09:00", end: "12:00" },
            { start: "13:00", end: "17:00" },
          ],
        })
        .build();

      expect(prettyPrintSchedule(schedule, interval).split("\n")).toEqual([
        "Heures de travail hebdomadaires : 21",
        "mercredi : 09:00-12:00, 13:00-17:00",
        "jeudi : libre",
        "vendredi : 09:00-12:00, 13:00-17:00",
        "samedi : 09:00-12:00, 13:00-17:00",
      ]);
      expect(
        prettyPrintSchedule(schedule, interval, false).split("\n"),
      ).toEqual([
        "Heures de travail hebdomadaires : 21",
        "mercredi : 09:00-12:00, 13:00-17:00",
        "vendredi : 09:00-12:00, 13:00-17:00",
        "samedi : 09:00-12:00, 13:00-17:00",
      ]);
    });

    it("prints long schedules", () => {
      const conventionWithLongSchedule = new ConventionDtoBuilder()
        .withDateStart(new Date("2023-07-26").toISOString())
        .withDateEnd(new Date("2023-08-10").toISOString())
        .withSchedule(reasonableSchedule)
        .build();

      expectToEqual(
        prettyPrintSchedule(
          conventionWithLongSchedule.schedule,
          {
            start: new Date(conventionWithLongSchedule.dateStart),
            end: new Date(conventionWithLongSchedule.dateEnd),
          },
          false,
        ).split("\n"),
        [
          "Heures de travail hebdomadaires : 35",
          "mercredi : 08:00-12:00, 13:00-16:00",
          "jeudi : 08:00-12:00, 13:00-16:00",
          "vendredi : 08:00-12:00, 13:00-16:00",
          "samedi : 08:00-12:00, 13:00-16:00",
          "dimanche : 08:00-12:00, 13:00-16:00",
          "Heures de travail hebdomadaires : 49",
          "lundi : 08:00-12:00, 13:00-16:00",
          "mardi : 08:00-12:00, 13:00-16:00",
          "mercredi : 08:00-12:00, 13:00-16:00",
          "jeudi : 08:00-12:00, 13:00-16:00",
          "vendredi : 08:00-12:00, 13:00-16:00",
          "samedi : 08:00-12:00, 13:00-16:00",
          "dimanche : 08:00-12:00, 13:00-16:00",
          "Heures de travail hebdomadaires : 28",
          "lundi : 08:00-12:00, 13:00-16:00",
          "mardi : 08:00-12:00, 13:00-16:00",
          "mercredi : 08:00-12:00, 13:00-16:00",
          "jeudi : 08:00-12:00, 13:00-16:00",
        ],
      );
    });

    it("prints schedules with schedule that have no timeperiod", () => {
      expect(
        prettyPrintSchedule(
          {
            totalHours: 12,
            workedDays: 4,
            isSimple: false,
            complexSchedule: [
              {
                date: "2022-07-18T00:00:00.000Z",
                timePeriods: [
                  {
                    start: "14:00",
                    end: "17:00",
                  },
                ],
              },
              {
                date: "2022-07-19T00:00:00.000Z",
                timePeriods: [],
              },
              {
                date: "2022-07-20T00:00:00.000Z",
                timePeriods: [
                  {
                    start: "10:00",
                    end: "12:00",
                  },
                  {
                    start: "14:00",
                    end: "16:00",
                  },
                ],
              },
              {
                date: "2022-07-21T00:00:00.000Z",
                timePeriods: [
                  {
                    start: "14:00",
                    end: "16:00",
                  },
                ],
              },
              {
                date: "2022-07-22T00:00:00.000Z",
                timePeriods: [],
              },
              {
                date: "2022-07-23T00:00:00.000Z",
                timePeriods: [
                  {
                    start: "09:00",
                    end: "12:00",
                  },
                ],
              },
              {
                date: "2022-07-24T00:00:00.000Z",
                timePeriods: [],
              },
            ],
          },
          {
            start: new Date("2022-07-18"),
            end: new Date("2022-07-24"),
          },
        ).split("\n"),
      ).toEqual([
        "Heures de travail hebdomadaires : 12",
        "lundi : 14:00-17:00",
        "mardi : libre",
        "mercredi : 10:00-12:00, 14:00-16:00",
        "jeudi : 14:00-16:00",
        "vendredi : libre",
        "samedi : 09:00-12:00",
        "dimanche : libre",
      ]);
    });

    describe("prints schedules on specific dates", () => {
      it("with winter time change", () => {
        expectToEqual(
          prettyPrintSchedule(
            new ScheduleDtoBuilder()
              .withDateInterval(winterDateChangeInterval)
              .withRegularSchedule({
                selectedDays: [0, 1, 2, 3, 4],
                timePeriods: [
                  { start: "09:00", end: "12:00" },
                  { start: "13:00", end: "17:00" },
                ],
              })
              .build(),
            winterDateChangeInterval,
          ).split("\n"),
          [
            "Heures de travail hebdomadaires : 35",
            "lundi : 09:00-12:00, 13:00-17:00",
            "mardi : 09:00-12:00, 13:00-17:00",
            "mercredi : 09:00-12:00, 13:00-17:00",
            "jeudi : 09:00-12:00, 13:00-17:00",
            "vendredi : 09:00-12:00, 13:00-17:00",
            "samedi : libre",
            "dimanche : libre",
            "Heures de travail hebdomadaires : 35",
            "lundi : 09:00-12:00, 13:00-17:00",
            "mardi : 09:00-12:00, 13:00-17:00",
            "mercredi : 09:00-12:00, 13:00-17:00",
            "jeudi : 09:00-12:00, 13:00-17:00",
            "vendredi : 09:00-12:00, 13:00-17:00",
          ],
        );
      });

      it("with summer time change", () => {
        expectToEqual(
          prettyPrintSchedule(
            new ScheduleDtoBuilder()
              .withDateInterval(summerDateChangeInterval)
              .withRegularSchedule({
                selectedDays: [0, 1, 2, 3, 4],
                timePeriods: [
                  { start: "09:00", end: "12:00" },
                  { start: "13:00", end: "17:00" },
                ],
              })
              .build(),
            summerDateChangeInterval,
          ).split("\n"),
          [
            "Heures de travail hebdomadaires : 35",
            "lundi : 09:00-12:00, 13:00-17:00",
            "mardi : 09:00-12:00, 13:00-17:00",
            "mercredi : 09:00-12:00, 13:00-17:00",
            "jeudi : 09:00-12:00, 13:00-17:00",
            "vendredi : 09:00-12:00, 13:00-17:00",
            "samedi : libre",
            "dimanche : libre",
            "Heures de travail hebdomadaires : 35",
            "lundi : 09:00-12:00, 13:00-17:00",
            "mardi : 09:00-12:00, 13:00-17:00",
            "mercredi : 09:00-12:00, 13:00-17:00",
            "jeudi : 09:00-12:00, 13:00-17:00",
            "vendredi : 09:00-12:00, 13:00-17:00",
          ],
        );
      });
    });

    it("calculate and shows totals hours correctly", () => {
      const interval: DateIntervalDto = {
        start: new Date("2024-06-03"),
        end: new Date("2024-06-06"),
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withComplexSchedule([
          {
            date: new Date("2024-06-03").toISOString(),
            timePeriods: [
              { start: "09:00", end: "12:45" },
              { start: "13:15", end: "17:00" },
            ],
          },
          {
            date: new Date("2024-06-04").toISOString(),
            timePeriods: [
              { start: "09:00", end: "12:45" },
              { start: "13:15", end: "17:30" },
            ],
          },
          {
            date: new Date("2024-06-05").toISOString(),
            timePeriods: [{ start: "09:00", end: "12:15" }],
          },
          {
            date: new Date("2024-06-06").toISOString(),
            timePeriods: [
              { start: "09:00", end: "12:45" },
              { start: "13:15", end: "17:00" },
            ],
          },
        ])
        .build();

      expectToEqual(
        prettyPrintSchedule(schedule, interval),
        `Heures de travail hebdomadaires : 26.25
lundi : 09:00-12:45, 13:15-17:00
mardi : 09:00-12:45, 13:15-17:30
mercredi : 09:00-12:15
jeudi : 09:00-12:45, 13:15-17:00`,
      );
    });
  });

  describe("calculateTotalDurationInDays", () => {
    it("calculates correctly the total duration in days for a complex schedule", () => {
      const expectedForShortSchedule = 6;
      const expectedForLongSchedule = 16;
      const exampleShortComplexSchedule: ScheduleDto = complexSchedule();
      const exampleLongComplexSchedule: ScheduleDto = longComplexSchedule();
      expect(
        calculateScheduleTotalDurationInDays(
          exampleShortComplexSchedule.complexSchedule,
        ),
      ).toEqual(expectedForShortSchedule);
      expect(
        calculateScheduleTotalDurationInDays(
          exampleLongComplexSchedule.complexSchedule,
        ),
      ).toEqual(expectedForLongSchedule);
    });

    it("calculates correctly the total duration in days for a regular schedule", () => {
      const expectedForShortSchedule = 6;
      const expectedForLongSchedule = 11;
      const exampleShortRegularSchedule: ScheduleDto = regularSchedule();
      const exampleLongRegularSchedule: ScheduleDto = longRegularSchedule();
      expect(
        calculateScheduleTotalDurationInDays(
          exampleShortRegularSchedule.complexSchedule,
        ),
      ).toEqual(expectedForShortSchedule);
      expect(
        calculateScheduleTotalDurationInDays(
          exampleLongRegularSchedule.complexSchedule,
        ),
      ).toEqual(expectedForLongSchedule);
    });
  });

  describe("calculateWeeklyHoursFromSchedule", () => {
    it("calculates correctly the total number of hours from a complex schedule", () => {
      const interval: DateIntervalDto = {
        start: new Date("2022-06-06"),
        end: new Date("2022-06-10"),
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withRegularSchedule({
          selectedDays: [0, 2, 3],
          timePeriods: [
            { start: "09:00", end: "12:30" },
            { start: "14:00", end: "18:00" },
          ],
        })
        .build();

      const weeklyHours = calculateWeeklyHoursFromSchedule(schedule, interval);
      expectToEqual(weeklyHours, [22.5]);
    });
  });

  describe("CalculateTotalImmersionHoursFromComplexSchedule", () => {
    it("calculates correctly the total number of hours from a complex schedule", () => {
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval({
          start: new Date("2022-06-06"),
          end: new Date("2022-06-10"),
        })
        .withRegularSchedule({
          selectedDays: [0, 2, 3],
          timePeriods: [
            { start: "09:00", end: "12:30" },
            { start: "14:00", end: "18:00" },
          ],
        })
        .build();

      expectToEqual(
        calculateTotalImmersionHoursFromComplexSchedule(
          schedule.complexSchedule,
        ),
        22.5,
      );
    });
  });

  describe("dayPeriodsFromComplexSchedule", () => {
    const timePeriods = [
      { start: "09:00", end: "12:30" },
      { start: "14:00", end: "18:00" },
    ];
    const dateInterval = {
      start: new Date("2022-06-29"),
      end: new Date("2022-07-21"),
    };

    describe("with no schedule", () => {
      it("empty day period without simple schedule build", () => {
        const schedule = new ScheduleDtoBuilder()
          .withDateInterval(dateInterval)
          .build();
        expect(
          selectedDaysFromComplexSchedule(schedule.complexSchedule),
        ).toEqual([]);
      });

      it(`dayperiods '${JSON.stringify([])}'`, () => {
        const schedule = new ScheduleDtoBuilder()
          .withDateInterval(dateInterval)
          .withRegularSchedule({ selectedDays: [], timePeriods })
          .build();
        expect(
          selectedDaysFromComplexSchedule(schedule.complexSchedule),
        ).toEqual([]);
      });

      it("should not validate schema without any timeperiod", () => {
        const emptySchedule = new ScheduleDtoBuilder()
          .withRegularSchedule({
            selectedDays: [],
            timePeriods: [],
          })
          .build();
        const conventionWithEmptySchedule = new ConventionDtoBuilder()
          .withSchedule(() => emptySchedule)
          .build();

        expect(() =>
          conventionSchema.parse(conventionWithEmptySchedule),
        ).toThrow(
          new ZodError([
            {
              code: "custom",
              input: undefined,
              message:
                "Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Veuillez remplir les horaires.",
              path: ["schedule"],
            },
          ]),
        );
      });

      describe("check matching totalHours and worked days", () => {
        const scheduleBuilder = new ScheduleDtoBuilder()
          .withDateInterval({
            start: new Date("2022-06-06"),
            end: new Date("2022-06-10"),
          })
          .withRegularSchedule({
            selectedDays: [0, 2, 3],
            timePeriods: [
              { start: "09:00", end: "12:30" },
              { start: "14:00", end: "18:00" },
            ],
          });

        it("does not validate schema if totalHours do not match calculated one", () => {
          const schedule = scheduleBuilder.withTotalHours(3).build();
          const conventionWithSchedule = new ConventionDtoBuilder()
            .withSchedule(() => schedule)
            .build();

          expect(() => conventionSchema.parse(conventionWithSchedule)).toThrow(
            new ZodError([
              {
                code: "custom",
                input: undefined,
                message:
                  "Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Le nombre total d'heure ne correspond pas à celui du calendrier. Calcul du calendrier: 22.5, Nombre total heures fourni: 3",
                path: ["schedule"],
              },
            ]),
          );
        });

        it("validates schema if totalHours matches calculated one", () => {
          const schedule = scheduleBuilder.withTotalHours(22.5).build();
          const validated = scheduleSchema.parse(schedule);
          expectToEqual(validated.totalHours, 22.5);
        });

        it("does not validate schema if workedDays do not match calculated one", () => {
          const schedule = scheduleBuilder.withWorkedDays(1).build();
          const conventionWithSchedule = new ConventionDtoBuilder()
            .withSchedule(() => schedule)
            .build();

          expect(() => conventionSchema.parse(conventionWithSchedule)).toThrow(
            new ZodError([
              {
                code: "custom",
                input: undefined,
                message:
                  "Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Le nombre total de jours travaillés ne correspond pas à celui du calendrier. Calcul du calendrier: 3, Nombre de jours fourni: 1",
                path: ["schedule"],
              },
            ]),
          );
        });

        it("validates schema if workedDays matches calculated one", () => {
          const schedule = scheduleBuilder.withWorkedDays(3).build();
          const validated = scheduleSchema.parse(schedule);
          expectToEqual(validated.workedDays, 3);
        });
      });
    });

    describe("with one day period of one day", () => {
      const selectedDaysScenarios: SelectedDaysOfTheWeekDto[] = [
        [0],
        [1],
        [2],
        [3],
        [4],
        [5],
        [6],
      ];
      selectedDaysScenarios.forEach((selectedDays) =>
        it(`selectedDay '${JSON.stringify(selectedDays)}'`, () => {
          const schedule = new ScheduleDtoBuilder()
            .withDateInterval(dateInterval)
            .withRegularSchedule({
              selectedDays,
              timePeriods,
            })
            .build();
          expect(
            selectedDaysFromComplexSchedule(schedule.complexSchedule),
          ).toEqual(selectedDays);
        }),
      );
    });

    describe("validate selectedDaysFromComplexSchedule", () => {
      const selectedDaysScenarios: SelectedDaysOfTheWeekDto[] = [
        [0, 1],
        [2, 3],
        [2, 3, 4],
        [1, 2, 3, 4, 5, 6],
        [3, 4, 5, 6],
        [0, 1, 2, 3, 4],
        [5, 6],
        [0, 4],
        [2, 4, 6],
        [0, 1, 3, 4],
        [0, 1, 2, 3, 4, 6],
        [1, 2, 4, 5],
        [0, 2, 3, 4, 6],
      ];
      selectedDaysScenarios.forEach((selectedDays) =>
        it(`selectedDay '${JSON.stringify(selectedDays)}'`, () => {
          const schedule = new ScheduleDtoBuilder()
            .withDateInterval(dateInterval)
            .withRegularSchedule({
              selectedDays,
              timePeriods,
            })
            .build();
          expect(
            selectedDaysFromComplexSchedule(schedule.complexSchedule),
          ).toEqual(selectedDays);
        }),
      );
    });
  });

  describe("dateTimeIsoStringSchema schema", () => {
    it.each(["2022-07-05", "Not a date", "31-07-2022"])(
      "parse '%s' is not valid",
      (date) => {
        expect(() => dateTimeIsoStringSchema.parse(date)).toThrow(
          new ZodError([
            {
              origin: "string",
              code: "invalid_format",
              format: "datetime",
              pattern:
                "/^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$/",
              path: [],
              message: localization.invalidDate,
            } as unknown as z.core.$ZodIssueInvalidStringFormat, // TODO: fix this, don't know why type is not valid
          ]),
        );
      },
    );

    it.each(["2022-02-27T10:00:00.001Z", new Date().toISOString()])(
      "parse '%s' is valid",
      (date) => {
        expect(dateTimeIsoStringSchema.parse(date)).toBe(
          new Date(date).toISOString(),
        );
      },
    );
  });

  describe("french hour changes (changement d'heure)", () => {
    it("schedule with 26th March", () => {
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(summerDateChangeInterval)
        .withRegularSchedule({
          selectedDays: [0, 1, 2, 3, 4, 5, 6],
          timePeriods: [{ start: "09:00", end: "10:00" }],
        })
        .build();
      expectToEqual(schedule.complexSchedule, [
        {
          date: new Date("2023-03-20").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-21").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-22").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-23").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-24").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-25").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-26").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-27").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-28").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-29").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-30").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-03-31").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
      ]);
      expectToEqual(
        calculateTotalImmersionHoursFromComplexSchedule(
          schedule.complexSchedule,
        ),
        12,
      );
      expectToEqual(calculateNumberOfWorkedDays(schedule.complexSchedule), 12);
    });

    it("schedule with 30th October", () => {
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(winterDateChangeInterval)
        .withRegularSchedule({
          selectedDays: [0, 1, 2, 3, 4, 5, 6],
          timePeriods: [{ start: "09:00", end: "10:00" }],
        })
        .build();
      expectToEqual(schedule.complexSchedule, [
        {
          date: new Date("2023-10-23").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-24").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-25").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-26").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-27").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-28").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-29").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-30").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-10-31").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-11-01").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-11-02").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: new Date("2023-11-03").toISOString(),
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
      ]);
      expectToEqual(schedule.complexSchedule, [
        {
          date: "2023-10-23T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-24T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-25T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-26T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-27T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-28T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-29T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-30T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-10-31T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-11-01T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-11-02T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
        {
          date: "2023-11-03T00:00:00.000Z",
          timePeriods: [{ start: "09:00", end: "10:00" }],
        },
      ]);
      expectToEqual(
        calculateTotalImmersionHoursFromComplexSchedule(
          schedule.complexSchedule,
        ),
        12,
      );
      expectToEqual(calculateNumberOfWorkedDays(schedule.complexSchedule), 12);
    });
  });

  describe("isSundayInSchedule", () => {
    it("return false if schedule does not contain sunday", () => {
      const complexSchedule = makeDailySchedule(new Date("2023-07-18"), [
        { start: "01:00", end: "02:00" },
      ]);

      expect(isSundayInSchedule([complexSchedule])).toBe(false);
    });

    it("return true if schedule contains sunday", () => {
      const complexSchedule = makeDailySchedule(new Date("2023-07-23"), [
        { start: "01:00", end: "02:00" },
      ]);

      expect(isSundayInSchedule([complexSchedule])).toBe(true);
    });
  });

  describe("validate makeImmersionTimetable", () => {
    it("should make a weekly timetable based on complex schedule", () => {
      const interval = {
        start: new Date("2023-07-30"),
        end: new Date("2023-08-07"),
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withRegularSchedule({
          selectedDays: [6],
          timePeriods: [
            { start: "09:00", end: "12:00" },
            { start: "13:00", end: "17:00" },
          ],
        })
        .build();
      expectToEqual(
        makeImmersionTimetable(schedule.complexSchedule, interval),
        [
          [
            {
              date: new Date("2023-07-24").toISOString(),
              timePeriods: null,
            },
            {
              date: new Date("2023-07-25").toISOString(),
              timePeriods: null,
            },
            {
              date: new Date("2023-07-26").toISOString(),
              timePeriods: null,
            },
            {
              date: new Date("2023-07-27").toISOString(),
              timePeriods: null,
            },
            {
              date: "2023-07-28T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-07-29T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-07-30T00:00:00.000Z",
              timePeriods: [
                { start: "09:00", end: "12:00" },
                { start: "13:00", end: "17:00" },
              ],
            },
          ],
          [
            {
              date: "2023-07-31T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-01T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-02T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-03T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-04T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-05T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-06T00:00:00.000Z",
              timePeriods: [
                { start: "09:00", end: "12:00" },
                { start: "13:00", end: "17:00" },
              ],
            },
          ],
          [
            {
              date: "2023-08-07T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-08T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-09T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-10T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-11T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-12T00:00:00.000Z",
              timePeriods: null,
            },
            {
              date: "2023-08-13T00:00:00.000Z",
              timePeriods: null,
            },
          ],
        ],
      );
    });

    it("should make a weekly timetable based on another complex schedule", () => {
      const interval = {
        start: new Date("2023-09-15"),
        end: new Date("2023-09-21"),
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withRegularSchedule({
          selectedDays: [0, 6],
          timePeriods: [{ start: "09:00", end: "12:00" }],
        })
        .build();
      expectToEqual(
        makeImmersionTimetable(schedule.complexSchedule, interval),
        [
          [
            {
              timePeriods: null,
              date: "2023-09-11T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-12T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-13T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-14T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-15T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-16T00:00:00.000Z",
            },
            {
              date: "2023-09-17T00:00:00.000Z",
              timePeriods: [{ start: "09:00", end: "12:00" }],
            },
          ],
          [
            {
              date: "2023-09-18T00:00:00.000Z",
              timePeriods: [{ start: "09:00", end: "12:00" }],
            },
            {
              timePeriods: null,
              date: "2023-09-19T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-20T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-21T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-22T00:00:00.000Z",
            },
            {
              timePeriods: null,
              date: "2023-09-23T00:00:00.000Z",
            },
            {
              date: "2023-09-24T00:00:00.000Z",
              timePeriods: null,
            },
          ],
        ],
      );
    });
  });

  describe("makeWeeklySchedule", () => {
    it("should make a weekly schedule on one week that starts a monday", () => {
      const interval = {
        start: new Date("2025-05-19"), //lundi
        end: new Date("2025-05-21"), //mercredi
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withComplexSchedule([
          makeDailySchedule(new Date("2025-05-19"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-20"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-21"), []),
        ])
        .build();

      const weeklySchedule = makeWeeklySchedule(schedule, interval);

      expectArraysToEqual(weeklySchedule, [
        {
          period: {
            start: new Date("2025-05-19T00:00:00.000Z"),
            end: new Date("2025-05-21T00:00:00.000Z"),
          },
          schedule: [
            "lundi : 01:00-02:00",
            "mardi : 01:00-02:00",
            "mercredi : libre",
          ],
          weeklyHours: 2,
        },
      ]);
    });

    it("should make a weekly schedule on one week that starts a wednesday", () => {
      const interval = {
        start: new Date("2025-05-21"), //mercredi
        end: new Date("2025-05-24"), //samedi
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withComplexSchedule([
          makeDailySchedule(new Date("2025-05-21"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-22"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-23"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-24"), []),
        ])
        .build();

      const weeklySchedule = makeWeeklySchedule(schedule, interval);

      expectArraysToEqual(weeklySchedule, [
        {
          period: {
            start: new Date("2025-05-21T00:00:00.000Z"),
            end: new Date("2025-05-24T00:00:00.000Z"),
          },
          schedule: [
            "mercredi : 01:00-02:00",
            "jeudi : 01:00-02:00",
            "vendredi : 01:00-02:00",
            "samedi : libre",
          ],
          weeklyHours: 3,
        },
      ]);
    });

    it("should make a weekly schedule on two weeks", () => {
      const interval = {
        start: new Date("2025-05-21"), //mercredi
        end: new Date("2025-05-31"), //samedi
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withComplexSchedule([
          makeDailySchedule(new Date("2025-05-21"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-22"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-23"), []),
          makeDailySchedule(new Date("2025-05-24"), []),
          makeDailySchedule(new Date("2025-05-25"), []),
          makeDailySchedule(new Date("2025-05-26"), []),
          makeDailySchedule(new Date("2025-05-27"), []),
          makeDailySchedule(new Date("2025-05-28"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-29"), []),
          makeDailySchedule(new Date("2025-05-30"), []),
          makeDailySchedule(new Date("2025-05-31"), []),
        ])
        .build();

      const weeklySchedule = makeWeeklySchedule(schedule, interval);

      expectArraysToEqual(weeklySchedule, [
        {
          period: {
            start: new Date("2025-05-21T00:00:00.000Z"),
            end: new Date("2025-05-25T00:00:00.000Z"),
          },
          schedule: [
            "mercredi : 01:00-02:00",
            "jeudi : 01:00-02:00",
            "vendredi : libre",
            "samedi : libre",
            "dimanche : libre",
          ],
          weeklyHours: 2,
        },
        {
          period: {
            end: new Date("2025-05-31T00:00:00.000Z"),
            start: new Date("2025-05-26T00:00:00.000Z"),
          },
          schedule: [
            "lundi : libre",
            "mardi : libre",
            "mercredi : 01:00-02:00",
            "jeudi : libre",
            "vendredi : libre",
            "samedi : libre",
          ],
          weeklyHours: 1,
        },
      ]);
    });

    it("should make a weekly schedule on three weeks", () => {
      const interval = {
        start: new Date("2025-05-21"), //mercredi
        end: new Date("2025-06-07"), //samedi
      };
      const schedule = new ScheduleDtoBuilder()
        .withDateInterval(interval)
        .withComplexSchedule([
          makeDailySchedule(new Date("2025-05-21"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-22"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-23"), []),
          makeDailySchedule(new Date("2025-05-24"), []),
          makeDailySchedule(new Date("2025-05-25"), []),
          makeDailySchedule(new Date("2025-05-26"), []),
          makeDailySchedule(new Date("2025-05-27"), []),
          makeDailySchedule(new Date("2025-05-28"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-05-29"), []),
          makeDailySchedule(new Date("2025-05-30"), []),
          makeDailySchedule(new Date("2025-05-31"), []),
          makeDailySchedule(new Date("2025-06-01"), []),
          makeDailySchedule(new Date("2025-06-02"), []),
          makeDailySchedule(new Date("2025-06-03"), []),
          makeDailySchedule(new Date("2025-06-04"), []),
          makeDailySchedule(new Date("2025-06-05"), [
            { start: "01:00", end: "02:00" },
          ]),
          makeDailySchedule(new Date("2025-06-06"), []),
          makeDailySchedule(new Date("2025-06-07"), []),
        ])
        .build();

      const weeklySchedule = makeWeeklySchedule(schedule, interval);

      expectArraysToEqual(weeklySchedule, [
        {
          period: {
            start: new Date("2025-05-21T00:00:00.000Z"),
            end: new Date("2025-05-25T00:00:00.000Z"),
          },
          schedule: [
            "mercredi : 01:00-02:00",
            "jeudi : 01:00-02:00",
            "vendredi : libre",
            "samedi : libre",
            "dimanche : libre",
          ],
          weeklyHours: 2,
        },
        {
          period: {
            start: new Date("2025-05-26T00:00:00.000Z"),
            end: new Date("2025-06-01T00:00:00.000Z"),
          },
          schedule: [
            "lundi : libre",
            "mardi : libre",
            "mercredi : 01:00-02:00",
            "jeudi : libre",
            "vendredi : libre",
            "samedi : libre",
            "dimanche : libre",
          ],
          weeklyHours: 1,
        },
        {
          period: {
            end: new Date("2025-06-07T00:00:00.000Z"),
            start: new Date("2025-06-02T00:00:00.000Z"),
          },
          schedule: [
            "lundi : libre",
            "mardi : libre",
            "mercredi : libre",
            "jeudi : 01:00-02:00",
            "vendredi : libre",
            "samedi : libre",
          ],
          weeklyHours: 1,
        },
      ]);
    });
  });
});

const complexSchedule = () =>
  new ScheduleDtoBuilder()
    .withComplexSchedule([
      makeDailySchedule(new Date("2022-06-13"), [
        { start: "01:00", end: "02:00" },
      ]),
      makeDailySchedule(new Date("2022-06-14"), []),
      makeDailySchedule(new Date("2022-06-15"), []),
      makeDailySchedule(new Date("2022-06-16"), [
        { start: "01:00", end: "02:00" },
        { start: "03:00", end: "04:00" },
      ]),
      makeDailySchedule(new Date("2022-06-17"), []),
      makeDailySchedule(new Date("2022-06-18"), []),
      makeDailySchedule(new Date("2022-06-19"), [
        { start: "01:00", end: "02:00" },
        { start: "03:00", end: "04:00" },
        { start: "05:00", end: "06:00" },
      ]),
    ])
    .build();

const longComplexSchedule = () =>
  new ScheduleDtoBuilder()
    .withComplexSchedule([
      makeDailySchedule(new Date("2023-06-13"), [
        { start: "01:00", end: "02:00" },
      ]),
      makeDailySchedule(new Date("2023-06-14"), []),
      makeDailySchedule(new Date("2023-06-15"), []),
      makeDailySchedule(new Date("2023-06-16"), [
        { start: "01:00", end: "02:00" },
        { start: "03:00", end: "04:00" },
      ]),
      makeDailySchedule(new Date("2023-06-17"), []),
      makeDailySchedule(new Date("2023-06-27"), []),
      makeDailySchedule(new Date("2023-06-29"), [
        { start: "01:00", end: "02:00" },
        { start: "03:00", end: "04:00" },
        { start: "05:00", end: "06:00" },
      ]),
    ])
    .build();

const regularSchedule = () =>
  new ScheduleDtoBuilder()
    .withRegularSchedule({
      selectedDays: [0, 2, 3, 6],
      timePeriods: [
        { start: "01:00", end: "02:00" },
        { start: "03:00", end: "04:00" },
      ],
    })
    .build();

const longRegularSchedule = () =>
  new ScheduleDtoBuilder()
    .withDateInterval({
      start: new Date("2022-06-15"),
      end: new Date("2022-06-26"),
    })
    .withRegularSchedule({
      selectedDays: [0, 2, 3, 6],
      timePeriods: [
        { start: "01:00", end: "02:00" },
        { start: "03:00", end: "04:00" },
      ],
    })
    .build();

const winterDateChangeInterval: DateIntervalDto = {
  start: new Date("2023-10-23"),
  end: new Date("2023-11-03"),
};

const summerDateChangeInterval: DateIntervalDto = {
  start: new Date("2023-03-20"),
  end: new Date("2023-03-31"),
};

describe("datetime schema validation", () => {
  it("should parse a valid datetime", () => {
    expect(() =>
      dateTimeIsoStringSchema.parse(new Date().toISOString()),
    ).not.toThrow();
  });

  it("should not parse an invalid datetime", () => {
    expect(() => dateTimeIsoStringSchema.parse("not a date")).toThrow();
  });

  it("should handle optional", () => {
    const dateTimeIsoStringSchemaOptionalInObject = z.object({
      date: dateTimeIsoStringSchema.optional(),
    });
    expect(() =>
      dateTimeIsoStringSchemaOptionalInObject.parse({}),
    ).not.toThrow();
  });
});
