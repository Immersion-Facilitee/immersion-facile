import type { BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import {
  type AgencySubSection,
  ConventionWeeklySchedule,
  CopyButton,
} from "react-design-system";
import type {
  ConventionSummarySection,
  ConventionSummarySubSection,
} from "react-design-system/src/immersionFacile/components/convention-summary";
import { useDispatch } from "react-redux";
import {
  addressDtoToString,
  type ConventionReadDto,
  convertLocaleDateToUtcTimezoneDate,
  type DateString,
  domElementIds,
  type Email,
  getFormattedFirstnameAndLastname,
  makeSiretDescriptionLink,
  makeWeeklySchedule,
  type NotificationKind,
  type PhoneNumber,
  remoteWorkModeLabels,
  removeEmptyValue,
  type ScheduleDto,
  type Signatory,
  type SignatoryRole,
  toDisplayedDate,
} from "shared";
import { SendReminderModal } from "src/app/components/convention/SendReminderModal";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";

const shouldDisplayAgencyValidationStatusBadge = (
  convention: ConventionReadDto,
): boolean =>
  convention.status === "IN_REVIEW" ||
  convention.status === "ACCEPTED_BY_COUNSELLOR";

const getAgencyApprovalStatusBadge = (
  convention: ConventionReadDto,
): BadgeProps | undefined => {
  if (convention.agencyRefersTo && convention.dateApproval)
    return {
      children: `Pré-validée - Le ${toDisplayedDate({
        date: new Date(convention.dateApproval),
      })}`,
      severity: "success",
    };

  if (
    shouldDisplayAgencyValidationStatusBadge(convention) &&
    convention.agencyRefersTo &&
    !convention.dateApproval
  )
    return {
      children: "Pré-validation en attente",
      severity: "warning",
    };

  return undefined;
};

const getAgencyValidationStatusBadge = (
  convention: ConventionReadDto,
): BadgeProps | undefined => {
  if (convention.dateValidation)
    return {
      children: `Validée - Le ${toDisplayedDate({
        date: new Date(convention.dateValidation),
      })}`,
      severity: "success",
    };

  if (
    shouldDisplayAgencyValidationStatusBadge(convention) &&
    !convention.dateValidation
  )
    return {
      children: "Validation en attente",
      severity: "warning",
    };

  return undefined;
};

export const makeAgencySubSection = (
  convention: ConventionReadDto,
): AgencySubSection => {
  const prescriberAgencyName = convention.agencyRefersTo
    ? convention.agencyRefersTo.name
    : convention.agencyName;

  return {
    agencyReferent: {
      fullName:
        getFormattedFirstnameAndLastname(convention.agencyReferent ?? {}) ?? "",
    },
    ...(convention.agencyRefersTo
      ? {
          refersToAgency: {
            structureName: convention.agencyName,
            structureCopyButton: (
              <CopyButton
                withIcon={true}
                textToCopy={convention.agencyName}
                label="Copier la structure d'accompagnement"
                iconOnly
                className="fr-ml-1v"
              />
            ),
            representedBy: convention.validators?.agencyCounsellor
              ? getFormattedFirstnameAndLastname(
                  convention.validators.agencyCounsellor,
                )
              : undefined,
            statusBadge: getAgencyApprovalStatusBadge(convention),
          },
        }
      : {}),
    agency: {
      title: convention.agencyRefersTo ? "Prescripteur lié" : "Prescripteur",
      structureName: prescriberAgencyName,
      structureCopyButton: (
        <CopyButton
          withIcon={true}
          textToCopy={prescriberAgencyName}
          label="Copier le prescripteur"
          iconOnly
          className="fr-ml-1v"
        />
      ),
      representedBy: convention.validators?.agencyValidator
        ? getFormattedFirstnameAndLastname(
            convention.validators.agencyValidator,
          )
        : undefined,
      statusBadge: getAgencyValidationStatusBadge(convention),
    },
  };
};

export const makeConventionSummaryContent = (
  convention: ConventionReadDto,
  signatoriesSubsectionButtonProps?: (
    signatoryRole: SignatoryRole,
    signatoryPhone: PhoneNumber,
    signatoryEmail: Email,
    signatoryAlreadySign: boolean,
  ) => ButtonProps | null,
  assesmentReminderButtonProps?: (phone: PhoneNumber) => ButtonProps,
  assessmentSignatureReminderButtonProps?: () => ButtonProps | null,
) => ({
  summary: makeConventionSections(
    convention,
    signatoriesSubsectionButtonProps,
    assesmentReminderButtonProps,
    assessmentSignatureReminderButtonProps,
  ),
  agencySubSection: makeAgencySubSection(convention),
});

const makeSignatoriesSubsections = (
  convention: ConventionReadDto,
  signatoriesSubsectionButtonProps?: (
    signatoryRole: SignatoryRole,
    signatoryPhone: PhoneNumber,
    signatoryEmail: Email,
    signatoryAlreadySign: boolean,
  ) => ButtonProps | null,
  assessmentSignatureReminderButtonProps?: () => ButtonProps | null,
): ConventionSummarySubSection[] => {
  const shouldDisplayDefaultSignatoryBadge =
    convention.status === "READY_TO_SIGN" ||
    convention.status === "PARTIALLY_SIGNED";
  const defaultSignatoryBadgeValue = (): BadgeProps | undefined =>
    shouldDisplayDefaultSignatoryBadge
      ? {
          children: "Signature en attente",
          severity: "warning",
        }
      : undefined;

  return removeEmptyValue([
    {
      key: "beneficiary",
      header: {
        title: "Bénéficiaire",
        badge: convention.signatories.beneficiary.signedAt
          ? ({
              children:
                convention.signatories.beneficiary.signedAt &&
                `Signée - Le ${toDisplayedDate({
                  date: new Date(convention.signatories.beneficiary.signedAt),
                })}`,
              severity: "success",
            } satisfies BadgeProps)
          : defaultSignatoryBadgeValue(),
        action: (() => {
          if (
            ["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(convention.status) &&
            signatoriesSubsectionButtonProps
          )
            return (
              signatoriesSubsectionButtonProps(
                "beneficiary",
                convention.signatories.beneficiary.phone,
                convention.signatories.beneficiary.email,
                !!convention.signatories.beneficiary.signedAt,
              ) ?? undefined
            );

          if (assessmentSignatureReminderButtonProps)
            return assessmentSignatureReminderButtonProps() ?? undefined;

          return undefined;
        })(),
      },
      fields: removeEmptyValue([
        {
          key: "beneficiaryFirstname",
          label: "Prénom",
          value: getFormattedFirstnameAndLastname({
            firstname: convention.signatories.beneficiary.firstName,
          }),
        },
        {
          key: "beneficiaryLastname",
          label: "Nom",
          value: getFormattedFirstnameAndLastname({
            lastname: convention.signatories.beneficiary.lastName,
          }),
        },
        {
          key: "beneficiaryEmail",
          label: "Email",
          value: (
            <a
              href={`mailto:${convention.signatories.beneficiary.email}`}
              title={convention.signatories.beneficiary.email}
            >
              {convention.signatories.beneficiary.email}
            </a>
          ),
          copyButton: (
            <CopyButton
              withIcon={true}
              textToCopy={convention.signatories.beneficiary.email}
              priority="tertiary no outline"
              label="Copier l'email du bénéficiaire"
              iconOnly
              className="fr-ml-1v"
            />
          ),
        },
        {
          key: "beneficiaryPhone",
          label: "Téléphone",
          value: convention.signatories.beneficiary.phone,
        },
      ]),
    },
    convention.signatories.beneficiaryRepresentative
      ? {
          key: "beneficiaryRepresentative",
          header: {
            title: "Représentant légal du bénéficiaire",
            badge: convention.signatories.beneficiaryRepresentative.signedAt
              ? ({
                  children:
                    convention.signatories.beneficiaryRepresentative.signedAt &&
                    `Signée - Le ${toDisplayedDate({
                      date: new Date(
                        convention.signatories.beneficiaryRepresentative
                          .signedAt,
                      ),
                    })}`,
                  severity: "success",
                } satisfies BadgeProps)
              : defaultSignatoryBadgeValue(),
            action:
              ["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(
                convention.status,
              ) && signatoriesSubsectionButtonProps
                ? (signatoriesSubsectionButtonProps(
                    "beneficiary-representative",
                    convention.signatories.beneficiaryRepresentative.phone,
                    convention.signatories.beneficiaryRepresentative.email,
                    !!convention.signatories.beneficiaryRepresentative.signedAt,
                  ) ?? undefined)
                : undefined,
          },
          fields: removeEmptyValue([
            {
              key: "beneficiaryRepFirstname",
              label: "Prénom",
              value: getFormattedFirstnameAndLastname({
                firstname:
                  convention.signatories.beneficiaryRepresentative.firstName,
              }),
            },
            {
              key: "beneficiaryRepLastname",
              label: "Nom",
              value: getFormattedFirstnameAndLastname({
                lastname:
                  convention.signatories.beneficiaryRepresentative.lastName,
              }),
            },
            {
              key: "beneficiaryRepEmail",
              label: "Email",
              value: (
                <a
                  href={`mailto:${convention.signatories.beneficiaryRepresentative.email}`}
                  title={convention.signatories.beneficiaryRepresentative.email}
                >
                  {convention.signatories.beneficiaryRepresentative.email}
                </a>
              ),
              copyButton: (
                <CopyButton
                  withIcon={true}
                  textToCopy={
                    convention.signatories.beneficiaryRepresentative.email
                  }
                  label="Copier l'email du représentant légal du bénéficiaire"
                  iconOnly
                  className="fr-ml-1v"
                />
              ),
            },
            {
              key: "beneficiaryRepPhone",
              label: "Téléphone",
              value: convention.signatories.beneficiaryRepresentative.phone,
            },
          ]),
        }
      : null,
    {
      key: "establishmentRepresentative",
      header: {
        title: "Représentant de l'entreprise",
        badge: convention.signatories.establishmentRepresentative.signedAt
          ? ({
              children:
                convention.signatories.establishmentRepresentative.signedAt &&
                `Signée - Le ${toDisplayedDate({
                  date: new Date(
                    convention.signatories.establishmentRepresentative.signedAt,
                  ),
                })}`,
              severity: "success",
            } satisfies BadgeProps)
          : defaultSignatoryBadgeValue(),
        action:
          ["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(convention.status) &&
          signatoriesSubsectionButtonProps
            ? (signatoriesSubsectionButtonProps(
                "establishment-representative",
                convention.signatories.establishmentRepresentative.phone,
                convention.signatories.establishmentRepresentative.email,
                !!convention.signatories.establishmentRepresentative.signedAt,
              ) ?? undefined)
            : undefined,
      },
      fields: removeEmptyValue([
        {
          key: "establishmentRepFirstname",
          label: "Prénom",
          value: getFormattedFirstnameAndLastname({
            firstname:
              convention.signatories.establishmentRepresentative.firstName,
          }),
        },
        {
          key: "establishmentRepLastname",
          label: "Nom",
          value: getFormattedFirstnameAndLastname({
            lastname:
              convention.signatories.establishmentRepresentative.lastName,
          }),
        },
        {
          key: "establishmentRepEmail",
          label: "Email",
          value: (
            <a
              href={`mailto:${convention.signatories.establishmentRepresentative.email}`}
              title={convention.signatories.establishmentRepresentative.email}
            >
              {convention.signatories.establishmentRepresentative.email}
            </a>
          ),
          copyButton: (
            <CopyButton
              withIcon={true}
              textToCopy={
                convention.signatories.establishmentRepresentative.email
              }
              label="Copier l'email du représentant de l'entreprise"
              iconOnly
              className="fr-ml-1v"
            />
          ),
        },
        {
          key: "establishmentRepPhone",
          label: "Téléphone",
          value: convention.signatories.establishmentRepresentative.phone,
        },
        {
          key: "establishmentRepSiret",
          label: "SIRET",
          value: renderSiret(convention.siret),
          copyButton: (
            <CopyButton
              withIcon={true}
              textToCopy={convention.siret}
              label="Copier le SIRET"
              iconOnly
              className="fr-ml-1v"
            />
          ),
        },
      ]),
    },
    convention.signatories.beneficiaryCurrentEmployer
      ? {
          key: "beneficiaryCurrentEmployer",
          header: {
            title: "Employeur actuel du bénéficiaire",
            badge: convention.signatories.beneficiaryCurrentEmployer.signedAt
              ? ({
                  children:
                    convention.signatories.beneficiaryCurrentEmployer
                      .signedAt &&
                    `Signée - Le ${toDisplayedDate({
                      date: new Date(
                        convention.signatories.beneficiaryCurrentEmployer
                          .signedAt,
                      ),
                    })}`,
                  severity: "success",
                } satisfies BadgeProps)
              : defaultSignatoryBadgeValue(),
            action:
              ["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(
                convention.status,
              ) && signatoriesSubsectionButtonProps
                ? (signatoriesSubsectionButtonProps(
                    "beneficiary-current-employer",
                    convention.signatories.beneficiaryCurrentEmployer.phone,
                    convention.signatories.beneficiaryCurrentEmployer.email,
                    !!convention.signatories.beneficiaryCurrentEmployer
                      .signedAt,
                  ) ?? undefined)
                : undefined,
          },
          fields: removeEmptyValue([
            {
              key: "beneficiaryCurrentEmployerFirstname",
              label: "Prénom",
              value: getFormattedFirstnameAndLastname({
                firstname:
                  convention.signatories.beneficiaryCurrentEmployer.firstName,
              }),
            },
            {
              key: "beneficiaryCurrentEmployerLastname",
              label: "Nom",
              value: getFormattedFirstnameAndLastname({
                lastname:
                  convention.signatories.beneficiaryCurrentEmployer.lastName,
              }),
            },
            {
              key: "beneficiaryCurrentEmployerEmail",
              label: "Email",
              value: (
                <a
                  href={`mailto:${convention.signatories.beneficiaryCurrentEmployer.email}`}
                  title={
                    convention.signatories.beneficiaryCurrentEmployer.email
                  }
                >
                  {convention.signatories.beneficiaryCurrentEmployer.email}
                </a>
              ),
              copyButton: (
                <CopyButton
                  withIcon={true}
                  textToCopy={
                    convention.signatories.beneficiaryCurrentEmployer.email
                  }
                  label="Copier l'email de l'employeur actuel du bénéficiaire"
                  iconOnly
                  className="fr-ml-1v"
                />
              ),
            },
            {
              key: "beneficiaryCurrentEmployerPhone",
              label: "Téléphone",
              value: convention.signatories.beneficiaryCurrentEmployer.phone,
            },
            {
              key: "beneficiaryCurrentEmployerSiret",
              label: "SIRET",
              value: renderSiret(
                convention.signatories.beneficiaryCurrentEmployer.businessSiret,
              ),
            },
            convention.signatories.beneficiaryCurrentEmployer.job
              ? {
                  key: "beneficiaryCurrentEmployerJob",
                  label: "Poste",
                  value: convention.signatories.beneficiaryCurrentEmployer.job,
                }
              : null,
          ]),
        }
      : null,
  ]);
};

const makeBeneficiarySubSections = (
  convention: ConventionReadDto,
): ConventionSummarySubSection[] => {
  return [
    {
      key: "beneficiairy",
      header: {
        title: "Bénéficiaire",
      },
      fields: removeEmptyValue([
        {
          key: "beneficiaryBirthdate",
          label: "Date de naissance",
          value: toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.signatories.beneficiary.birthdate),
            ),
          }),
        },
        {
          key: "beneficiaryRqth",
          label: "RQTH",
          value: convention.signatories.beneficiary.isRqth ? "Oui" : "Non",
        },
        {
          key: "beneficiaryFinanciaryHelp",
          label: "Aide matérielle",
          value: convention.signatories.beneficiary.financiaryHelp || "Aucune",
        },
        convention.internshipKind === "mini-stage-cci" &&
        convention.signatories.beneficiary.address
          ? {
              key: "beneficiaryAddress",
              label: "Adresse du candidat",
              value:
                convention.internshipKind === "mini-stage-cci" &&
                convention.signatories.beneficiary.address &&
                addressDtoToString(convention.signatories.beneficiary.address),
            }
          : null,
        convention.internshipKind === "mini-stage-cci" &&
        convention.signatories.beneficiary.levelOfEducation
          ? {
              key: "beneficiaryLevelOfEducation",
              label: "Niveau d'études",
              value: convention.signatories.beneficiary.levelOfEducation,
            }
          : null,
        convention.internshipKind === "mini-stage-cci" &&
        convention.signatories.beneficiary.schoolName
          ? {
              key: "beneficiarySchoolName",
              label: "Établissement",
              value: convention.signatories.beneficiary.schoolName,
            }
          : null,
        convention.internshipKind === "mini-stage-cci" &&
        convention.signatories.beneficiary.schoolPostcode
          ? {
              key: "beneficiarySchoolName",
              label: "Code postal de l'établissement",
              value: convention.signatories.beneficiary.schoolPostcode,
            }
          : null,
      ]),
    },
    {
      key: "emergencyContact",
      header: { title: "Contact d'urgence" },
      fields: [
        {
          key: "emergencyContactName",
          label: "Prénom et nom",
          value: convention.signatories.beneficiary.emergencyContact || "-",
        },
        {
          key: "emergencyContactEmail",
          label: "Email",
          value:
            convention.signatories.beneficiary.emergencyContactEmail || "-",
        },
        {
          key: "emergencyContactPhone",
          label: "Téléphone",
          value:
            convention.signatories.beneficiary.emergencyContactPhone || "-",
        },
      ],
    },
  ];
};

const makeEstablishmentSubSections = (
  convention: ConventionReadDto,
  assesmentReminderButtonProps?: (phone: PhoneNumber) => ButtonProps,
): ConventionSummarySubSection[] => {
  return [
    {
      key: "establishment",
      header: {
        title: "Entreprise",
        badge: !convention.isEstablishmentBanned
          ? undefined
          : ({
              severity: "error",
              small: true,
              children: "ENTREPRISE BANNIE",
            } satisfies BadgeProps),
      },
      fields: removeEmptyValue([
        {
          key: "siret",
          label: "SIRET",
          value: renderSiret(convention.siret),
        },
        {
          key: "businessName",
          label: "Nom (raison sociale)",
          value: convention.businessName,
        },
        convention.businessNameCustomized
          ? {
              key: "businessNameCustomized",
              label: "Nom d'enseigne",
              value: convention.businessNameCustomized,
            }
          : null,
      ]),
    },
    {
      key: "establishmentTutor",
      header: {
        title: "Tuteur",
        action: assesmentReminderButtonProps
          ? assesmentReminderButtonProps(convention.establishmentTutor.phone)
          : undefined,
      },
      fields: [
        {
          key: "establishmentTutorFirstname",
          label: "Prénom",
          value: getFormattedFirstnameAndLastname({
            firstname: convention.establishmentTutor.firstName,
          }),
        },
        {
          key: "establishmentTutorLastname",
          label: "Nom",
          value: getFormattedFirstnameAndLastname({
            lastname: convention.establishmentTutor.lastName,
          }),
        },
        {
          key: "establishmentTutorJob",
          label: "Poste",
          value: convention.establishmentTutor.job,
        },
        {
          key: "establishmentTutorEmail",
          label: "Email",
          value: (
            <a
              href={`mailto:${convention.establishmentTutor.email}`}
              title={convention.establishmentTutor.email}
            >
              {convention.establishmentTutor.email}
            </a>
          ),
          copyButton: (
            <CopyButton
              withIcon={true}
              textToCopy={convention.establishmentTutor.email}
              label="Copier l'email du tuteur"
              iconOnly
              className="fr-ml-1v"
            />
          ),
        },
        {
          key: "establishmentTutorPhone",
          label: "Téléphone",
          value: convention.establishmentTutor.phone,
        },
      ],
    },
  ];
};

const makeImmersionSubSections = (
  convention: ConventionReadDto,
): ConventionSummarySubSection[] => {
  return [
    {
      key: "immersionAddress",
      isFullWidthDisplay: true,
      fields: [
        {
          key: "immersionAddress",
          label: "Lieu où se fera l'immersion",
          value: convention.immersionAddress,
        },
      ],
    },
    {
      key: "immersion",
      header: {
        title: `Métier observé : ${convention.immersionAppellation.appellationLabel}`,
      },
      isFullWidthDisplay: true,
      fields: [
        {
          key: "immersionObjective",
          label: `Objectif ${
            convention.internshipKind === "immersion"
              ? "de l'immersion"
              : "du mini-stage"
          }`,
          value: convention.immersionObjective,
        },
        {
          key: "immersionActivities",
          label: "Activités observées",
          value: convention.immersionActivities,
        },
        {
          key: "immersionSkills",
          label: "Compétences évaluées",
          value: convention.immersionSkills || "-",
        },
        {
          key: "remoteWorkMode",
          label: "Modalité de l'immersion",
          value: remoteWorkModeLabels[convention.remoteWorkMode].label,
        },
        {
          key: "workConditions",
          label: "Conditions de travail (propres au métier observé)",
          value: convention.workConditions || "-",
        },
        {
          key: "businessAdvantages",
          label: "Avantages proposés par l'établissement d'accueil",
          value: convention.businessAdvantages || "-",
        },
      ],
    },
    {
      key: "period",
      header: { title: "Emploi du temps" },
      isFullWidthDisplay: true,
      fields: [
        {
          key: "dateStart",
          label: "Date de début",
          value: toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.dateStart),
            ),
          }),
        },
        {
          key: "dateEnd",
          label: "Date de fin",
          value: toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.dateEnd),
            ),
          }),
        },
      ],
    },
    {
      key: "schedule",
      fields: [
        {
          key: "schedule",
          value: printWeekSchedule({
            schedule: convention.schedule,
            dateStart: convention.dateStart,
            dateEnd: convention.dateEnd,
            useWrapper: false,
          }),
        },
      ],
      isFullWidthDisplay: true,
      hasBackgroundColor: true,
      isSchedule: true,
    },
  ];
};

const makeAdditionalInformationSubSections = (
  convention: ConventionReadDto,
): ConventionSummarySubSection[] => {
  return [
    {
      key: "additionalInformation",
      isFullWidthDisplay: true,
      fields: [
        {
          key: "individualProtection",
          label: "Protection individuelle",
          value: convention.individualProtection
            ? `Oui${
                convention.individualProtectionDescription
                  ? ` : ${convention.individualProtectionDescription}`
                  : ""
              }`
            : "Non",
        },
        {
          key: "sanitaryPreventionDescription",
          label: "Mesures de prévention sanitaire",
          value: convention.sanitaryPrevention
            ? `Oui${
                convention.sanitaryPreventionDescription
                  ? ` : ${convention.sanitaryPreventionDescription}`
                  : ""
              }`
            : "Non",
        },
      ],
    },
  ];
};

export const makeConventionSections = (
  convention: ConventionReadDto,
  signatoriesSubsectionButtonProps?: (
    signatoryRole: SignatoryRole,
    signatoryPhone: PhoneNumber,
    signatoryEmail: Email,
    signatoryAlreadySign: boolean,
  ) => ButtonProps | null,
  assesmentReminderButtonProps?: (phone: PhoneNumber) => ButtonProps,
  assessmentSignatureReminderButtonProps?: () => ButtonProps | null,
): ConventionSummarySection[] => {
  return [
    {
      title: "Signataires de la convention",
      subSections: makeSignatoriesSubsections(
        convention,
        signatoriesSubsectionButtonProps,
        assessmentSignatureReminderButtonProps,
      ),
    },
    {
      title: "Informations sur le bénéficiaire",
      subSections: makeBeneficiarySubSections(convention),
    },
    {
      title: "Informations de l'entreprise",
      subSections: makeEstablishmentSubSections(
        convention,
        assesmentReminderButtonProps,
      ),
    },
    {
      title: "Informations sur l'immersion",
      subSections: makeImmersionSubSections(convention),
    },
    {
      title: "Informations complémentaires",
      subSections: makeAdditionalInformationSubSections(convention),
    },
  ];
};

export const printWeekSchedule = ({
  schedule,
  dateStart,
  dateEnd,
  useWrapper,
}: {
  schedule: ScheduleDto;
  dateStart: DateString;
  dateEnd: DateString;
  useWrapper: boolean;
}) => {
  const weeklyScheduleDto = makeWeeklySchedule(schedule, {
    start: convertLocaleDateToUtcTimezoneDate(new Date(dateStart)),
    end: convertLocaleDateToUtcTimezoneDate(new Date(dateEnd)),
  });
  return (
    <ConventionWeeklySchedule
      weeklySchedule={weeklyScheduleDto.map((week) => ({
        ...week,
        period: {
          start: toDisplayedDate({
            date: week.period.start,
          }),
          end: toDisplayedDate({
            date: week.period.end,
          }),
        },
      }))}
      useWrapper={useWrapper}
    />
  );
};

const renderSiret = (siret: string) => (
  <a
    href={makeSiretDescriptionLink(siret)}
    title={"Voir sur l'annuaire des entreprises"}
    target="_blank"
    rel="noreferrer"
  >
    {siret}
  </a>
);

export const sendSignatureLinkModal = createModal({
  id: domElementIds.manageConvention.sendSignatureLinkModal,
  isOpenedByDefault: false,
});

export const SendSignatureLinkModalWrapper = ({
  convention,
  signatory,
  onConfirm,
}: {
  convention: ConventionReadDto;
  signatory?: Signatory;
  onConfirm: (params: {
    notificationKind: NotificationKind;
    signatoryRole: SignatoryRole;
  }) => void;
}) => {
  const dispatch = useDispatch();

  return (
    <SendReminderModal
      modal={sendSignatureLinkModal}
      title="Relancer pour signature"
      phone={signatory?.phone ?? ""}
      email={signatory?.email ?? ""}
      radioGroupId={
        domElementIds.manageConvention.sendSignatureLinkModalReminderKindOptions
      }
      radioGroupName="send-signature-link-reminder-kind"
      submitButtonId={
        domElementIds.manageConvention.submitSendSignatureLinkModalButton
      }
      isSubmitDisabled={!signatory}
      lastReminderDateByNotificationKind={
        signatory &&
        convention.lastReminders.conventionSignatures[signatory.role]
      }
      recipientFullName={
        signatory && `${signatory.firstName} ${signatory.lastName}`
      }
      onCancel={() => dispatch(feedbackSlice.actions.clearFeedbacksTriggered())}
      onConfirm={(notificationKind) =>
        signatory &&
        onConfirm({
          notificationKind,
          signatoryRole: signatory.role,
        })
      }
      description={
        <p>
          {signatory
            ? `${signatory.firstName} ${signatory.lastName} n'a pas encore signé la convention.`
            : "Le signataire n'a pas encore signé la convention."}
        </p>
      }
    />
  );
};

export const sendAssessmentLinkModal = createModal({
  id: domElementIds.manageConvention.sendAssessmentLinkModal,
  isOpenedByDefault: false,
});

export const SendAssessmentLinkModalWrapper = ({
  convention,
  phone,
  email,
  onConfirm,
}: {
  convention: ConventionReadDto;
  phone: PhoneNumber;
  email: string;
  onConfirm: (notificationKind: NotificationKind) => void;
}) => (
  <SendReminderModal
    modal={sendAssessmentLinkModal}
    title="Relancer pour bilan"
    phone={phone}
    email={email}
    radioGroupId={
      domElementIds.manageConvention.sendAssessmentLinkModalReminderKindOptions
    }
    radioGroupName="send-assessment-link-reminder-kind"
    emailOnlyLegend="Le canal disponible pour envoyer une relance."
    lastReminderDateByNotificationKind={
      convention.lastReminders.assessmentCompletion
    }
    recipientFullName={`${convention.establishmentTutor.firstName} ${convention.establishmentTutor.lastName}`}
    onConfirm={onConfirm}
    description={<p>Le tuteur n'a pas encore complété le bilan.</p>}
  />
);

export const sendSignatureLinkButtonProps =
  ({
    triggeredByRole,
    onClick,
  }: {
    triggeredByRole?: SignatoryRole;
    onClick: (params: {
      signatoryRole: SignatoryRole;
      signatoryPhone: PhoneNumber;
      signatoryEmail: Email;
    }) => void;
  }) =>
  (
    signatoryRole: SignatoryRole,
    signatoryPhone: PhoneNumber,
    signatoryEmail: Email,
    signatoryAlreadySign: boolean,
  ): ButtonProps | null => {
    if (signatoryAlreadySign) return null;
    if (triggeredByRole && triggeredByRole === signatoryRole) return null;

    return {
      priority: "tertiary",
      children: "Relancer pour signature",
      onClick: () => {
        onClick({ signatoryRole, signatoryPhone, signatoryEmail });
      },
      type: "button",
      id: domElementIds.manageConvention.openSendSignatureLinkModal,
    };
  };

export const sendAssessmentLinkButtonProps =
  ({ onClick }: { onClick: (params: { phone: PhoneNumber }) => void }) =>
  (phone: PhoneNumber): ButtonProps => ({
    priority: "tertiary",
    children: "Relancer pour bilan",
    onClick: () => {
      onClick({ phone });
    },
    type: "button",
    id: domElementIds.manageConvention.openSendAssessmentLinkModal,
  });

export const sendAssessmentSignatureReminderModal = createModal({
  id: domElementIds.manageConvention.sendAssessmentSignatureReminderModal,
  isOpenedByDefault: false,
});

export const SendAssessmentSignatureReminderModalWrapper = ({
  convention,
  phone,
  email,
  beneficiaryFirstName,
  beneficiaryLastName,
  onConfirm,
}: {
  convention: ConventionReadDto;
  phone: PhoneNumber;
  email: Email;
  beneficiaryFirstName: string;
  beneficiaryLastName: string;
  onConfirm: (notificationKind: NotificationKind) => void;
}) => {
  const dispatch = useDispatch();

  return (
    <SendReminderModal
      modal={sendAssessmentSignatureReminderModal}
      title="Relancer pour signature du bilan"
      phone={phone}
      email={email}
      radioGroupId={
        domElementIds.manageConvention
          .sendAssessmentSignatureReminderModalReminderKindOptions
      }
      radioGroupName="send-assessment-signature-reminder-kind"
      submitButtonId={
        domElementIds.manageConvention
          .submitSendAssessmentSignatureReminderModalButton
      }
      lastReminderDateByNotificationKind={
        convention.lastReminders.assessmentSignature
      }
      recipientFullName={`${beneficiaryFirstName} ${beneficiaryLastName}`}
      onCancel={() => dispatch(feedbackSlice.actions.clearFeedbacksTriggered())}
      onConfirm={onConfirm}
      description={
        <p>
          {beneficiaryFirstName} {beneficiaryLastName} n'a pas encore signé le
          bilan.
        </p>
      }
    />
  );
};

export const sendAssessmentSignatureReminderButtonProps =
  ({ onClick }: { onClick: () => void }) =>
  (): ButtonProps => ({
    priority: "tertiary",
    children: "Relance signature bilan",
    onClick,
    type: "button",
    id: domElementIds.manageConvention.openSendAssessmentSignatureReminderModal,
  });
