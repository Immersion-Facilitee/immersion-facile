import type { ConventionDraftDto } from "shared";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";

export const conventionDraftSeed = async (uow: UnitOfWork) => {
  const ftAgencyId = "40400c99-9c0b-bbbb-bb6d-6bb9bd300404";
  const ftAgency = await uow.agencyRepository.getById(ftAgencyId);

  if (!ftAgency) {
    throw new Error("FT agency not found");
  }
  const conventionDraftImmersion: ConventionDraftDto = {
    id: "11111111-1111-4111-9111-111111111111",
    internshipKind: "immersion",
    remoteWorkMode: "ON_SITE",
    signatories: {
      beneficiary: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "0202020202",
        birthdate: "2000-10-10",
      },
      establishmentRepresentative: {
        firstName: "Bob",
        lastName: "Le Tuteur",
        email: "bob.letuteur@mail.com",
        phone: "0303030303",
      },
    },
    schedule: {
      totalHours: 21,
      workedDays: 3,
      isSimple: true,
      complexSchedule: [
        {
          date: "2026-01-12T00:00:00.000Z",
          timePeriods: [
            {
              start: "09:00",
              end: "12:00",
            },
            {
              start: "13:00",
              end: "17:00",
            },
          ],
        },
        {
          date: "2026-01-13T00:00:00.000Z",
          timePeriods: [
            {
              start: "09:00",
              end: "12:00",
            },
            {
              start: "13:00",
              end: "17:00",
            },
          ],
        },
        {
          date: "2026-01-14T00:00:00.000Z",
          timePeriods: [
            {
              start: "09:00",
              end: "12:00",
            },
            {
              start: "13:00",
              end: "17:00",
            },
          ],
        },
      ],
    },
    establishmentTutor: {
      firstName: "Bob",
      lastName: "Le Tuteur",
      email: "bob.letuteur@mail.com",
      phone: "0303030303",
      job: "Manager",
    },
    agencyId: ftAgency.id,
    agencyKind: "france-travail",
    agencyDepartment: ftAgency.address.departmentCode,
    dateStart: new Date("2026-01-12").toISOString(),
    dateEnd: new Date("2026-01-14").toISOString(),
    siret: "34493368400021",
    businessName: "FRANCE MERGUEZ DISTRIBUTION",
    individualProtection: true,
    individualProtectionDescription: "casque et lunettes",
    sanitaryPrevention: true,
    sanitaryPreventionDescription: "fourniture de gel",
    immersionAddress: "ZI VILLETANEUSE 6 RUE RAYMOND BROSSE 93430 VILLETANEUSE",
    immersionObjective: "Confirmer un projet professionnel",
    immersionAppellation: {
      appellationCode: "11573",
      appellationLabel: "Boulanger / Boulangère",
      romeCode: "D1102",
      romeLabel: "Boulangerie - viennoiserie",
    },
    immersionActivities: "Charcuttage de compét.",
  };
  await uow.conventionDraftRepository.save(
    conventionDraftImmersion,
    new Date().toISOString(),
  );
};
