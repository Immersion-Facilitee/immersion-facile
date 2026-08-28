import { DiscussionBuilder } from "shared";
import { v4 as uuid } from "uuid";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
} from "../../domains/establishment/helpers/EstablishmentBuilders";
import { seedUsers } from "./userSeed";

export const franceMerguez = new EstablishmentAggregateBuilder()
  .withEstablishment(
    new EstablishmentEntityBuilder()
      .withLocations([
        {
          id: new UuidV4Generator().new(),
          address: {
            city: "Villetaneuse",
            postcode: "93430",
            streetNumberAndAddress: "6 RUE RAYMOND BROSSE",
            departmentCode: "93",
          },
          position: { lat: 48.956, lon: 2.345 },
        },
        {
          id: new UuidV4Generator().new(),
          address: {
            city: "Paris",
            postcode: "75001",
            streetNumberAndAddress: "1 rue de Rivoli",
            departmentCode: "75",
          },
          position: { lat: 48.8566, lon: 2.3522 },
        },
      ])
      .withSiret("34493368400021")
      .withName("France Merguez Distribution")
      .withNafDto({ code: "1013A", nomenclature: "rev2" }) // NAF Section :Industrie manufacturière
      .build(),
  )
  .withOffers([
    new OfferEntityBuilder()
      .withAppellationCode("11569")
      .withAppellationLabel("Boucher-charcutier / Bouchère-charcutière")
      .withRomeCode("D1101")
      .build(),
    new OfferEntityBuilder()
      .withAppellationCode("12112")
      .withAppellationLabel("Boulanger / Boulangère")
      .withRomeCode("D1101")
      .withRemoteWorkMode("HYBRID")
      .build(),
    new OfferEntityBuilder()
      .withAppellationCode("10512")
      .withAppellationLabel("Vendeur / Vendeuse en articles de sport")
      .withRomeCode("D1211")
      .withRemoteWorkMode("FULL_REMOTE")
      .build(),
  ])
  .withUserRights([
    {
      userId: seedUsers.franceMerguezUser.id,
      role: "establishment-admin",
      status: "ACCEPTED",
      phone: "+33600110011",
      job: "Le Boss des merguez",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
    {
      userId: seedUsers.adminUser.id,
      role: "establishment-contact",
      status: "ACCEPTED",
      job: "la compta",
      phone: "+33672787844",
      shouldReceiveDiscussionNotifications: true,
    },
    {
      userId: seedUsers.icUser.id,
      role: "establishment-admin",
      status: "ACCEPTED",
      job: "Contact RH",
      phone: "+33672787846",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
  ])
  .build();

const decathlon = new EstablishmentAggregateBuilder()
  .withEstablishment(
    new EstablishmentEntityBuilder()
      .withSiret("50056940501696")
      .withName("Decathlon france")
      .withNafDto({ code: "4764Z", nomenclature: "rev2" }) // NAF Section : Commerce ; réparation d'automobiles et de motocycles
      .build(),
  )
  .withOffers([
    new OfferEntityBuilder()
      .withAppellationCode("20552")
      .withAppellationLabel("Vendeur / Vendeuse en articles de sport")
      .withRomeCode("D1211")
      .withRemoteWorkMode("ON_SITE")
      .build(),
    new OfferEntityBuilder()
      .withAppellationCode("11569")
      .withAppellationLabel("Boucher-charcutier / Bouchère-charcutière")
      .withRomeCode("D1211")
      .withRemoteWorkMode("HYBRID")
      .build(),
  ])
  .withUserRights([
    {
      userId: seedUsers.decathlonUser.id,
      role: "establishment-admin",
      status: "ACCEPTED",
      phone: "+33600110011",
      job: "The Big Boss @Decathlon",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
  ])
  .build();

export const establishmentSeed = async (uow: UnitOfWork) => {
  await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
    franceMerguez,
  );
  await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
    decathlon,
  );

  await uow.groupRepository.save({
    slug: "decathlon",
    sirets: [decathlon.establishment.siret],
    options: {
      heroHeader: {
        title: "Bienvenue chez Decathlon",
        description: "À fond la forme !",
      },
      tintColor: "#007DBC",
    },
    name: "Decathlon",
  });

  const franceMerguezLocationId =
    franceMerguez.establishment.locations.at(0)?.id;
  if (!franceMerguezLocationId)
    throw new Error(
      "Cannot seed discussions without an establishment location.",
    );

  const discussionId = "aaaaaaaa-9c0a-1aaa-aa6d-aaaaaaaaaaaa";
  await uow.discussionRepository.insert(
    new DiscussionBuilder()
      .withId(discussionId)
      .withSiret(franceMerguez.establishment.siret)
      .withAppellationCode("11569")
      .withPotentialBeneficiaryResumeLink(
        "https://www.docdroid.net/WyjIuyO/fake-resume-pdf",
      )
      .withPotentialBeneficiaryFirstname("Billy")
      .withPotentialBeneficiaryLastName("Idol")
      .withPotentialBeneficiaryEmail("billy.idol@mail.com")
      .withExchanges([
        {
          sender: "potentialBeneficiary",
          sentAt: new Date("2024-02-02").toISOString(),
          subject: "Présentation",
          message: "Bonjour, je me présente!",
          attachments: [],
        },
        {
          sender: "establishment",
          email: seedUsers.franceMerguezUser.email,
          firstname: seedUsers.franceMerguezUser.firstName,
          lastname: seedUsers.franceMerguezUser.lastName,
          sentAt: new Date("2024-02-03").toISOString(),
          subject: "Réponse entreprise",
          message: "Allez viens on est bien.",
          attachments: [],
        },
      ])
      .withLocationId(franceMerguezLocationId)
      .build(),
  );
  await uow.discussionRepository.insert(
    new DiscussionBuilder()
      .withId(uuid())
      .withSiret(franceMerguez.establishment.siret)
      .withAppellationCode("11569")
      .withPotentialBeneficiaryResumeLink(
        "https://www.docdroid.net/WyjIuyO/fake-resume-pdf",
      )
      .withPotentialBeneficiaryFirstname("Billy")
      .withPotentialBeneficiaryLastName("Idol")
      .withPotentialBeneficiaryEmail("billy.idol@mail.com")
      .withExchanges([
        {
          sender: "potentialBeneficiary",
          sentAt: new Date("2024-02-02").toISOString(),
          subject: "Présentation",
          message: "Bonjour, je me présente!",
          attachments: [],
        },
        {
          sender: "establishment",
          email: seedUsers.franceMerguezUser.email,
          firstname: seedUsers.franceMerguezUser.firstName,
          lastname: seedUsers.franceMerguezUser.lastName,
          sentAt: new Date("2024-06-03").toISOString(),
          subject: "Réponse entreprise",
          message: "Allez viens on est bien.",
          attachments: [],
        },
      ])
      .withStatus({ status: "REJECTED", rejectionKind: "DEPRECATED" })
      .withLocationId(franceMerguezLocationId)
      .build(),
  );
};
