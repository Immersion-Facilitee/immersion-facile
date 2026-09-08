import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { useEffect } from "react";
import {
  ConventionRenewedInformations,
  Document,
  Loader,
  MainWrapper,
  NPSForm,
} from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AgencyModifierRole,
  addressDtoToString,
  type ConventionId,
  type ConventionReadDto,
  convertLocaleDateToUtcTimezoneDate,
  domElementIds,
  errors,
  type frontRoutes,
  getFormattedFirstnameAndLastname,
  isConventionRenewed,
  isStringDate,
  makeSiretDescriptionLink,
  npsFormIds,
  prettyPrintSchedule,
  type SignatoryRole,
  toDisplayedDate,
} from "shared";
import { useConvention } from "src/app/hooks/convention.hooks";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useJwt } from "src/app/hooks/jwt.hooks";
import { usePdfGenerator } from "src/app/hooks/pdf.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { ShowConventionErrorOrRenewExpiredJwt } from "src/app/pages/convention/ShowConventionErrorOrRenewExpiredJwt";
import { frontErrors } from "src/app/pages/error/front-errors";
import { agenciesSelectors } from "src/core-logic/domain/agencies/agencies.selectors";
import { agenciesSlice } from "src/core-logic/domain/agencies/agencies.slice";
import type { Route } from "type-route";
import logoIf from "/assets/img/logo-if.svg";
import logoRf from "/assets/img/logo-rf.svg";

const throwOnMissingSignDate = (
  actor: SignatoryRole,
  signedAt: string | undefined,
): string => {
  if (!signedAt)
    throw errors.convention.missingSignatorySignature({ role: actor });
  return signedAt;
};

const throwOnMissingApprovalOrValidationDate = (
  actor: AgencyModifierRole,
  signedAt: string | undefined,
): string => {
  if (!signedAt)
    throw errors.convention.missingAgencyApprovalOrValidation({ role: actor });
  return signedAt;
};

const isStartingByVowel = (string: string): boolean => {
  const vowels = ["a", "e", "i", "o", "u", "y"];
  return Boolean(vowels.find((vowel) => vowel === string[0]?.toLowerCase()));
};

type ConventionDocumentPageProps = {
  route: Route<typeof frontRoutes.conventionDocument>;
};

type FormattedScheduleByWeek = {
  formattedHours: string;
  formattedDaySchedules: string;
}[];

const formatSchedule = (convention: ConventionReadDto) => {
  const scheduleByWeek: FormattedScheduleByWeek = [];
  prettyPrintSchedule(convention.schedule, {
    start: convertLocaleDateToUtcTimezoneDate(new Date(convention.dateStart)),
    end: convertLocaleDateToUtcTimezoneDate(new Date(convention.dateEnd)),
  })
    .split("\n")
    .forEach((line: string) => {
      if (line.includes("Heures de travail hebdomadaires : ")) {
        scheduleByWeek.push({
          formattedHours: line,
          formattedDaySchedules: "",
        });
      } else {
        const lastWeek = scheduleByWeek[scheduleByWeek.length - 1];
        lastWeek.formattedDaySchedules =
          lastWeek.formattedDaySchedules.length > 0
            ? `${lastWeek.formattedDaySchedules}, ${line}`
            : line;
      }
    });

  return (
    <ul>
      {scheduleByWeek.map((schedule) => (
        <li key={schedule.formattedHours}>
          <div>{schedule.formattedHours}</div>
          <div>{schedule.formattedDaySchedules}</div>
        </li>
      ))}
    </ul>
  );
};

export const ConventionDocumentPage = ({
  route,
}: ConventionDocumentPageProps) => {
  const routeConventionId: ConventionId | undefined = route.params.conventionId;
  const { jwt, jwtPayload } = useJwt(route);
  const { convention, isLoading } = useConvention({
    jwt,
    conventionId: routeConventionId ?? jwtPayload.applicationId,
  });
  const agencyInfo = useAppSelector(agenciesSelectors.details);
  const agencyFeedback = useAppSelector(agenciesSelectors.feedback);
  const canShowConvention = convention?.status === "ACCEPTED_BY_VALIDATOR";
  const dispatch = useDispatch();
  const { isPdfLoading, generateAndDownloadPdf } = usePdfGenerator();
  const conventionFormFeedback = useFeedbackTopic("convention-form");
  const fetchConventionError =
    conventionFormFeedback?.level === "error" &&
    conventionFormFeedback.on === "fetch";

  useEffect(() => {
    if (convention?.agencyId) {
      dispatch(
        agenciesSlice.actions.fetchAgencyInfoRequested(convention.agencyId),
      );
    }
  }, [convention?.agencyId, dispatch]);

  if (fetchConventionError)
    return (
      <MainWrapper layout="default">
        <ShowConventionErrorOrRenewExpiredJwt
          errorMessage={conventionFormFeedback?.message}
          jwt={jwt}
        />
      </MainWrapper>
    );

  if (isLoading) return <Loader />;
  if (!convention) return <p>Pas de convention correspondante trouvée</p>;
  if (!agencyInfo) return <p>Pas d'agence correspondante trouvée</p>;

  if (!canShowConvention) {
    if (convention.status === "CANCELLED") {
      throw frontErrors.convention.cancelled({
        conventionId: convention.id,
        justificationStatus: convention.statusJustification,
        agencyName: convention.agencyName,
      });
    }
  }

  const {
    beneficiary,
    establishmentRepresentative,
    beneficiaryCurrentEmployer,
    beneficiaryRepresentative,
  } = convention.signatories;
  const { internshipKind } = convention;
  const logos = [
    <img key="logo-rf" src={logoRf} alt="Logo RF" />,
    <img
      key={`logo-${agencyInfo.name}`}
      src={agencyInfo.logoUrl ? agencyInfo.logoUrl : logoIf}
      alt=""
    />,
  ];

  const title = isConventionRenewed(convention)
    ? "Renouvellement de convention"
    : "Convention";

  const agencyIsLoaded =
    agencyFeedback.kind === "agencyInfoFetched" && agencyInfo;

  return (
    <MainWrapper layout="default" vSpacing={8}>
      {isPdfLoading && <Loader />}
      <Document
        logos={logos}
        printButtonLabel={"Imprimer la convention"}
        title={
          internshipKind === "immersion"
            ? `${title} relative à la mise en œuvre d'une période de mise en situation en milieu professionnel`
            : `${title} de mini-stage`
        }
        beneficiaryName={getFormattedFirstnameAndLastname({
          firstname: beneficiary.firstName,
          lastname: beneficiary.lastName,
        })}
        businessName={
          convention.businessNameCustomized?.trim() || convention.businessName
        }
        internshipKind={internshipKind}
        customActions={[
          <Button
            key={"htmlToPdfButton"}
            priority="secondary"
            onClick={() =>
              generateAndDownloadPdf({
                conventionId: convention.id,
                prefix: "convention",
                jwt,
              })
            }
            className={fr.cx("fr-mr-1w")}
            id={domElementIds.conventionDocument.downloadPdfButton}
          >
            Télécharger en PDF
          </Button>,
        ]}
      >
        {isConventionRenewed(convention) && (
          <ConventionRenewedInformations renewed={convention.renewed} />
        )}

        <h2 className={fr.cx("fr-h4")}>La convention est établie entre :</h2>
        <ul>
          <li>
            <strong>
              {getFormattedFirstnameAndLastname({
                firstname: beneficiary.firstName,
                lastname: beneficiary.lastName,
              })}
            </strong>{" "}
            né(e) le{" "}
            <strong>
              {isStringDate(beneficiary.birthdate)
                ? toDisplayedDate({
                    date: convertLocaleDateToUtcTimezoneDate(
                      new Date(beneficiary.birthdate),
                    ),
                  })
                : "Date invalide"}
            </strong>{" "}
            en qualité de <strong>bénéficiaire</strong> {""}
            {beneficiary.isRqth && "reconnu en situation de handicap"}
            <ul>
              <li>tel.&nbsp;: {beneficiary.phone}</li>
              <li>email&nbsp;: {beneficiary.email}</li>
              {convention.internshipKind === "mini-stage-cci" && (
                <li>
                  adresse&nbsp;:{" "}
                  {convention.signatories.beneficiary.address &&
                    addressDtoToString(
                      convention.signatories.beneficiary.address,
                    )}
                </li>
              )}
            </ul>
          </li>
          {beneficiaryRepresentative && (
            <li>
              <strong>
                {getFormattedFirstnameAndLastname({
                  firstname: beneficiaryRepresentative.firstName,
                  lastname: beneficiaryRepresentative.lastName,
                })}
              </strong>{" "}
              en qualité de{" "}
              <strong>représentant(e) légal(e) du bénéficiaire</strong>
              <ul>
                <li>tel.&nbsp;: {beneficiaryRepresentative.phone}</li>
                <li>email&nbsp;: {beneficiaryRepresentative.email}</li>
              </ul>
            </li>
          )}
          {beneficiaryCurrentEmployer && (
            <li>
              <strong>
                {getFormattedFirstnameAndLastname({
                  firstname: beneficiaryCurrentEmployer.firstName,
                  lastname: beneficiaryCurrentEmployer.lastName,
                })}
              </strong>{" "}
              en qualité de{" "}
              <strong>représentant(e) de l'entreprise&nbsp;:</strong>{" "}
              {beneficiaryCurrentEmployer.businessName}{" "}
              <strong>employant actuellement le bénéficiaire</strong>
              <ul>
                <li>tel.&nbsp;: {beneficiaryCurrentEmployer.phone}</li>
                <li>email&nbsp;: {beneficiaryCurrentEmployer.email}</li>
                <li>
                  adresse&nbsp;: {beneficiaryCurrentEmployer.businessAddress}
                </li>
              </ul>
            </li>
          )}
          {establishmentRepresentative && (
            <li>
              <strong>
                {getFormattedFirstnameAndLastname({
                  firstname: establishmentRepresentative.firstName,
                  lastname: establishmentRepresentative.lastName,
                })}
              </strong>{" "}
              en qualité de{" "}
              <strong>
                représentant de{" "}
                {convention.businessNameCustomized?.trim()
                  ? `${convention.businessNameCustomized.trim()}, dont la raison sociale est ${convention.businessName}`
                  : convention.businessName}
              </strong>
              <ul>
                <li>tel.&nbsp;: {establishmentRepresentative.phone}</li>
                <li>email&nbsp;: {establishmentRepresentative.email}</li>
              </ul>
            </li>
          )}

          {agencyIsLoaded && agencyInfo.refersToAgency && (
            <>
              <li>
                <strong>{agencyInfo.name}</strong> (
                {agencyInfo.address.streetNumberAndAddress},{" "}
                {agencyInfo.address.postcode} {agencyInfo.address.city}) en
                qualité d'<strong>agence accompagnante.</strong>
                <ul>
                  <li>
                    <strong>Contact en cas de besoin : </strong>
                    {convention.agencyContactEmail}
                  </li>
                </ul>
              </li>
              <li>
                <strong>{agencyInfo.refersToAgency.name}</strong> (
                {agencyInfo.refersToAgency.address.streetNumberAndAddress},{" "}
                {agencyInfo.refersToAgency.address.postcode}{" "}
                {agencyInfo.refersToAgency.address.city}) en qualité d'
                <strong>agence prescriptrice.</strong>
                <ul>
                  <li>
                    <strong>Contact en cas de besoin : </strong>
                    {convention.agencyRefersTo?.contactEmail}
                  </li>
                </ul>
              </li>
            </>
          )}
          {agencyIsLoaded && !agencyInfo.refersToAgency && (
            <li>
              <strong>{agencyInfo.name}</strong> (
              {agencyInfo.address.streetNumberAndAddress},{" "}
              {agencyInfo.address.postcode} {agencyInfo.address.city}) en
              qualité d'<strong>agence prescriptrice.</strong>
              <ul>
                <li>
                  <strong>Contact en cas de besoin : </strong>
                  {convention.agencyContactEmail}
                </li>
              </ul>
            </li>
          )}
        </ul>
        <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>
          Informations relatives à la convention
        </h2>
        <ul>
          <li>
            Identifiant de la convention : <strong>{convention.id}</strong>
          </li>
          {convention.signatories.beneficiary.federatedIdentity?.provider ===
            "ftConnect" &&
            convention.signatories.beneficiary.federatedIdentity?.payload && (
              <li>
                conseiller France Travail (anciennement Pôle emploi) référent :{" "}
                <strong>
                  {getFormattedFirstnameAndLastname({
                    firstname:
                      convention.signatories.beneficiary.federatedIdentity
                        .payload.advisor?.firstName,
                    lastname:
                      convention.signatories.beneficiary.federatedIdentity
                        .payload.advisor?.lastName,
                  })}
                </strong>
              </li>
            )}
          {convention.validators?.agencyCounsellor && (
            <li>
              Pré-validée par : <strong>{convention.agencyName}</strong>{" "}
              représenté par :{" "}
              <strong>
                {getFormattedFirstnameAndLastname(
                  convention.validators.agencyCounsellor,
                )}
              </strong>{" "}
            </li>
          )}
          {convention.validators?.agencyValidator && (
            <li>
              Validée par :{" "}
              <strong>
                {convention.agencyRefersTo
                  ? convention.agencyRefersTo.name
                  : convention.agencyName}
              </strong>{" "}
              représenté par :{" "}
              <strong>
                {getFormattedFirstnameAndLastname(
                  convention.validators.agencyValidator,
                )}
              </strong>
            </li>
          )}
        </ul>

        <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>
          Dispositions relatives aux conditions de réalisation{" "}
          {internshipKind === "immersion" ? "de l’immersion" : "du mini-stage"}
        </h2>
        <h3 className={fr.cx("fr-h5")}>Activités confiées</h3>
        <p>
          {internshipKind === "immersion" ? "L'immersion" : "Le mini-stage"}{" "}
          aura pour objectif de découvrir les activités nécessaires en lien avec
          le métier{" "}
          {isStartingByVowel(convention.immersionAppellation.appellationLabel)
            ? "d'"
            : "de"}{" "}
          <strong>{convention.immersionAppellation.appellationLabel}</strong>.
        </p>
        <p>Ces activités sont : {convention.immersionActivities}.</p>

        {convention.immersionSkills !== "" && (
          <p>
            Les compétences et savoir-être observés sont :{" "}
            <strong>{convention.immersionSkills}</strong>.
          </p>
        )}
        <p>L’objet de l’immersion est : {convention.immersionObjective}</p>
        <h3 className={fr.cx("fr-h5")}>
          Conditions de mise en œuvre et d’évaluation
        </h3>
        <h4 className={fr.cx("fr-h6")}>Lieu et dates</h4>
        <p>
          {internshipKind === "immersion" ? "Cette immersion" : "Ce mini-stage"}{" "}
          se déroulera au sein de{" "}
          <strong>
            {convention.businessNameCustomized?.trim()
              ? `${convention.businessNameCustomized.trim()}, dont la raison sociale est ${convention.businessName}`
              : convention.businessName}
          </strong>{" "}
          (Siret n°
          <a
            href={makeSiretDescriptionLink(convention.siret)}
            target="_blank"
            rel="noreferrer"
          >
            {convention.siret}
          </a>
          ), à l'adresse <strong>{convention.immersionAddress}</strong>.
        </p>
        <p className={fr.cx("fr-text--bold")}>
          {internshipKind === "immersion" ? "L'immersion" : "Le mini-stage"} se
          déroulera du{" "}
          {toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.dateStart),
            ),
          })}{" "}
          au{" "}
          {toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.dateEnd),
            ),
          })}
          .
        </p>
        <div>
          <strong>
            Les horaires{" "}
            {internshipKind === "immersion"
              ? "de l'immersion"
              : "du mini-stage"}{" "}
            seront : {formatSchedule(convention)}
          </strong>
        </div>
        <h4 className={fr.cx("fr-h6", "fr-mt-4w")}>
          Conditions d'observation de l’activité
        </h4>
        {(convention.sanitaryPrevention || convention.individualProtection) && (
          <>
            <p>
              Dans le cadre de{" "}
              {internshipKind === "immersion"
                ? "cette immersion"
                : "ce mini-stage"}{" "}
              :
            </p>
            <ul>
              {convention.sanitaryPreventionDescription && (
                <li>
                  des mesures de prévention sanitaire sont prévues :{" "}
                  {convention.sanitaryPreventionDescription}
                </li>
              )}
              {convention.individualProtection && (
                <li>
                  des équipements de protection sont fournis :{" "}
                  {convention.individualProtectionDescription}
                </li>
              )}
            </ul>
          </>
        )}

        {convention.workConditions && (
          <p>
            Les conditions particulières d'exercice du métier sont :{" "}
            {convention.workConditions}
          </p>
        )}

        <p className={fr.cx("fr-mt-2w")}>Encadrement :</p>
        <p>
          <strong>
            {getFormattedFirstnameAndLastname({
              firstname: beneficiary.firstName,
              lastname: beneficiary.lastName,
            })}
          </strong>{" "}
          sera encadré(e) par{" "}
          <strong>
            {getFormattedFirstnameAndLastname({
              firstname: convention.establishmentTutor.firstName,
              lastname: convention.establishmentTutor.lastName,
            })}
          </strong>{" "}
          occupant la fonction{" "}
          {isStartingByVowel(convention.establishmentTutor.job)
            ? `d'${convention.establishmentTutor.job}`
            : `de ${convention.establishmentTutor.job}`}{" "}
          (tel.&nbsp;: {convention.establishmentTutor.phone}
          {convention.establishmentTutor.email !==
            establishmentRepresentative.email &&
            `, mail: ${convention.establishmentTutor.email}`}
          ).
        </p>

        <p>
          {getFormattedFirstnameAndLastname({
            firstname: beneficiary.firstName,
            lastname: beneficiary.lastName,
          })}
          {beneficiaryRepresentative && (
            <span>
              ,{" "}
              {getFormattedFirstnameAndLastname({
                firstname: beneficiaryRepresentative.firstName,
                lastname: beneficiaryRepresentative.lastName,
              })}
            </span>
          )}{" "}
          et{" "}
          {getFormattedFirstnameAndLastname({
            firstname: establishmentRepresentative.firstName,
            lastname: establishmentRepresentative.lastName,
          })}{" "}
          en signant cette convention, s'engagent à respecter les obligations
          réglementaires{" "}
          {internshipKind === "immersion"
            ? "de la Période de Mise en Situation Professionnelle"
            : "du mini-stage"}
          , rappelées ci-après.
        </p>

        {internshipKind === "mini-stage-cci" && (
          <p>
            Les étudiants ne sont pas soumis aux périodes de vacances scolaires
            mais ne doivent pas avoir de cours ou d’examen sur la période de
            stage.{" "}
            <strong>
              En signant cette convention, le bénéficiaire a attesté être libéré
              de toutes obligations étudiantes pendant la période de stage(ni
              cours, ni examens).
            </strong>
          </p>
        )}

        <h2 className={fr.cx("fr-h4")}>
          Toutes les parties ci-dessus ont signé cette convention par le moyen
          d'une signature électronique&nbsp;:
        </h2>
        <div className={fr.cx("fr-card", "fr-p-2w")}>
          <ul>
            <li>
              √ Le bénéficiaire,{" "}
              <strong>
                {getFormattedFirstnameAndLastname({
                  firstname: beneficiary.firstName,
                  lastname: beneficiary.lastName,
                })}
              </strong>{" "}
              (signé le{" "}
              {toDisplayedDate({
                date: new Date(
                  throwOnMissingSignDate("beneficiary", beneficiary.signedAt),
                ),
                withHours: true,
              })}
              )
            </li>
            {beneficiaryRepresentative && (
              <li>
                √ Le représentant légal du bénéficiaire,{" "}
                <strong>
                  {getFormattedFirstnameAndLastname({
                    firstname: beneficiaryRepresentative.firstName,
                    lastname: beneficiaryRepresentative.lastName,
                  })}
                </strong>{" "}
                (signé le{" "}
                {toDisplayedDate({
                  date: convertLocaleDateToUtcTimezoneDate(
                    new Date(
                      throwOnMissingSignDate(
                        "beneficiary-representative",
                        beneficiaryRepresentative.signedAt,
                      ),
                    ),
                  ),
                  withHours: true,
                })}
                )
              </li>
            )}
            {beneficiaryCurrentEmployer && (
              <li>
                √ Le représentant de l'entreprise employant actuellement le
                bénéficiaire,{" "}
                <strong>
                  {getFormattedFirstnameAndLastname({
                    firstname: beneficiaryCurrentEmployer.firstName,
                    lastname: beneficiaryCurrentEmployer.lastName,
                  })}
                </strong>{" "}
                (signé le{" "}
                {toDisplayedDate({
                  date: convertLocaleDateToUtcTimezoneDate(
                    new Date(
                      throwOnMissingSignDate(
                        "beneficiary-current-employer",
                        beneficiaryCurrentEmployer.signedAt,
                      ),
                    ),
                  ),
                })}
                )
              </li>
            )}
            <li>
              √ Le représentant de l'entreprise d'accueil,{" "}
              <strong>
                {getFormattedFirstnameAndLastname({
                  firstname: establishmentRepresentative.firstName,
                  lastname: establishmentRepresentative.lastName,
                })}
              </strong>{" "}
              (signé le{" "}
              {toDisplayedDate({
                date: convertLocaleDateToUtcTimezoneDate(
                  new Date(
                    throwOnMissingSignDate(
                      "establishment-representative",
                      establishmentRepresentative.signedAt,
                    ),
                  ),
                ),
              })}
              )
            </li>
            {!convention.agencyRefersTo && (
              <li>
                √ L'agence prescriptrice{" "}
                {internshipKind === "immersion"
                  ? "de l'immersion"
                  : "du mini-stage"}
                , <strong>{convention.agencyName}</strong> (validé le{" "}
                {toDisplayedDate({
                  date: convertLocaleDateToUtcTimezoneDate(
                    new Date(
                      throwOnMissingApprovalOrValidationDate(
                        "validator",
                        convention.dateValidation,
                      ),
                    ),
                  ),
                })}
                )
              </li>
            )}
            {convention.agencyRefersTo && (
              <>
                <li>
                  √ L'agence prescriptrice{" "}
                  {internshipKind === "immersion"
                    ? "de l'immersion"
                    : "du mini-stage"}
                  , <strong>{convention.agencyRefersTo.name}</strong> (validé le{" "}
                  {toDisplayedDate({
                    date: convertLocaleDateToUtcTimezoneDate(
                      new Date(
                        throwOnMissingApprovalOrValidationDate(
                          "validator",
                          convention.dateValidation,
                        ),
                      ),
                    ),
                  })}
                  ).
                </li>
                <li>
                  √ La structure d'accompagnement du candidat,{" "}
                  <strong>{convention.agencyName}</strong> (validé le{" "}
                  {toDisplayedDate({
                    date: convertLocaleDateToUtcTimezoneDate(
                      new Date(
                        throwOnMissingApprovalOrValidationDate(
                          "counsellor",
                          convention.dateApproval,
                        ),
                      ),
                    ),
                  })}
                  ).
                </li>
              </>
            )}
          </ul>
        </div>

        {agencyInfo && (
          <p className={fr.cx("fr-mt-4w")}>{agencyInfo.signature}</p>
        )}

        <hr className={fr.cx("fr-hr", "fr-mb-6w", "fr-mt-10w")} />
        <footer className={fr.cx("fr-text--xs")}>
          {internshipKind === "immersion" && (
            <>
              <p className={fr.cx("fr-text--xs")}>
                <strong>* Obligations des parties </strong>
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Le bénéficiaire s’engage à exercer les activités et tâches
                telles que définies dans la présente convention et à mettre en
                œuvre l’ensemble des actions lui permettant d’atteindre les
                objectifs d’insertion socioprofessionnelle attendus, et
                notamment :
              </p>
              <ul>
                <li>
                  Respecter le règlement intérieur de la structure d’accueil et
                  les consignes qui lui sont données et informer le conseiller
                  référent de tout retard ou absence en fournissant les
                  documents justificatifs requis
                </li>
                <li>
                  Se conformer à l’ensemble des dispositions et mesures en
                  matière d’hygiène et de sécurité applicables aux salariés dans
                  la structure d’accueil, notamment en matière de port
                  obligatoire des EPI et propres aux activités et tâches
                  confiées
                </li>
                <li>
                  Informer le conseiller référent de tout incident et/ou
                  accident
                </li>
                <li>
                  Informer le conseiller référent et/ou la personne responsable
                  de son accueil et de son suivi des difficultés qu’il pourrait
                  rencontrer dans la mise en œuvre de cette période
                </li>
                <li>
                  Auto évaluer l’apport de la période de mise en situation en
                  milieu professionnel dans la construction de son parcours
                  d’insertion socioprofessionnelle.
                </li>
              </ul>
              <p className={fr.cx("fr-text--xs")}>
                La structure d’accueil s’engage à prendre l’ensemble des
                dispositions nécessaires en vue de permettre au bénéficiaire
                d’exercer les activités et tâches telles que définies dans la
                présente convention, à l’accompagner afin de lui permettre
                d’atteindre les objectifs d’insertion socioprofessionnelle
                attendus, et notamment à :
              </p>

              <ul>
                <li>
                  Désigner une personne chargée d’accueillir, d’aider,
                  d’informer, de guider et d’évaluer le bénéficiaire pendant la
                  période de mise en situation en milieu professionnel
                </li>
                <li>
                  Ne pas faire exécuter au bénéficiaire une tâche régulière
                  correspondant à un poste de travail permanent, à un
                  accroissement temporaire d’activité, à un emploi saisonnier ou
                  au remplacement d’un salarié en cas d’absence ou de suspension
                  de son contrat de travail
                </li>
                <li>
                  S’assurer que la mise en situation en milieu professionnel
                  respecte les règles applicables à ses salariés pour ce qui a
                  trait aux durées quotidienne et hebdomadaire de présence, à la
                  présence de nuit, au repos quotidien, hebdomadaire et aux
                  jours fériés
                </li>
                <li>
                  Etre couvert par une assurance Multirisque Professionnelle en
                  cours de validité tant à l’encontre de tiers que sur des biens
                  de la structure d’accueil.
                </li>
                <li>
                  Mettre en œuvre toutes les dispositions nécessaires en vue de
                  se conformer aux articles R.4141-3-1 et suivants du code du
                  travail en matière d’information des salariés sur les règles
                  d’hygiène et de sécurité applicables dans son établissement et
                  fournir l’ensemble des EPI nécessaires
                </li>
                <li>
                  Prévenir dès connaissance des faits, et au plus tard dans les
                  24 heures, la structure d’accompagnement de tout accident
                  survenant soit au cours ou sur le lieu de la mise en situation
                  en milieu professionnel, soit au cours du trajet
                  domicile-structure d’accueil
                </li>
                <li>
                  Donner accès aux moyens de transport et installations
                  collectifs
                </li>
                <li>
                  Libérer, à la demande de la structure d’accompagnement, le
                  bénéficiaire chaque fois que cela s’avère nécessaire.
                </li>
              </ul>
              <p className={fr.cx("fr-text--xs")}>
                La structure d’accompagnement s’engage, en la personne du
                conseiller référent, à assurer la mise en œuvre de la période de
                mise en situation en milieu professionnel et notamment à :
              </p>
              <ul>
                <li>
                  Assurer l’accompagnement dans la structure d’accueil du
                  bénéficiaire au travers de visites et d’entretiens sous toute
                  forme
                </li>
                <li>
                  Intervenir, à la demande de la structure d’accueil et/ou du
                  bénéficiaire pour régler toute difficulté pouvant survenir
                  pendant la période de mise en situation en milieu
                  professionnel
                </li>
                <li>
                  Informer sans délai l’organisme prescripteur ou, si le
                  bénéficiaire est salarié, l’employeur de ce dernier, de tout
                  accident survenant au cours ou sur le lieu de la mise en
                  situation en milieu professionnel ou de trajet qui lui serait
                  signalé dans le cadre de cette période
                </li>
                <li>
                  Réaliser le bilan / évaluation de la mise en situation
                  réalisée, transmis, le cas échéant, à l’organisme prescripteur
                </li>
              </ul>
              <p className={fr.cx("fr-text--xs")}>
                L’organisme prescripteur s’engage, à :
              </p>
              <ul>
                <li>
                  Analyser la pertinence de la période de mise en situation en
                  milieu professionnel proposée et d’en définir des objectifs
                  adaptés aux besoins, possibilités et capacités tant du
                  bénéficiaire que de la structure d’accueil
                </li>
                <li>
                  Procéder à la déclaration dans les 48 heures de tout accident
                  de travail ou de trajet qui lui serait signalé auprès de la
                  Caisse Primaire d’Assurance Maladie du lieu de résidence du
                  bénéficiaire dès lors qu’il couvre le risque AT/MP
                </li>
              </ul>
            </>
          )}
          {internshipKind === "mini-stage-cci" && (
            <>
              <p className={fr.cx("fr-text--xs")}>
                <strong>
                  *CONVENTION RELATIVE À L’ORGANISATION DES PERIODES
                  D’OBSERVATION EN MILIEU PROFESSIONNEL
                </strong>
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Cette convention est établie en application des dispositions des
                articles L124-3-1, L332-3-1 et L332-3-2 du code de l’éducation
                et de l’article L.4153-1 du code du travail, offrant la
                possibilité : • aux jeunes des deux derniers niveaux
                d’enseignement des collèges ou aux jeunes des lycées de réaliser
                des périodes d’observation en entreprise d’une durée maximale
                d’une semaine durant les vacances scolaires ; • aux étudiants de
                l’enseignement supérieur de réaliser des périodes d’observation
                en entreprise d’une durée maximale d’une semaine, en dehors des
                semaines réservées aux cours et au contrôle de connaissances.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                <strong>
                  La convention doit être établie, signée par toutes les parties
                  et visée par une des 3 Chambres consulaires (CCI, CMA ou
                  chambre d'agriculture) avant le démarrage de la période
                  d’observation. Sans visa, la convention ne pourra être
                  exécutée.
                </strong>
              </p>
              <p className={fr.cx("fr-text--xs")}>
                TITRE PREMIER : DISPOSITIONS GÉNÉRALES
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 1 – Objet La présente convention a pour objet la mise en
                œuvre d’une période d’observation en milieu professionnel, au
                bénéfice du jeune ci-dessus désigné.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 2 – Modalités particulières Les objectifs et les
                modalités de la période d’observation sont consignés dans
                l’annexe pédagogique. Les modalités de prise en charge des frais
                afférents à cette période ainsi que les modalités d’assurances
                sont définies dans l’annexe financière.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 3 – Organisation L’organisation de la période
                d’observation est déterminée d’un commun accord entre les
                parties ci-dessus désignées, avec le concours de la Chambre
                consulaire concernée.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 4 – Conditions financières Durant la période
                d’observation en milieu professionnel, le jeune ne peut
                prétendre à aucune rémunération ou gratification de l’entreprise
                ou de l’organisme d’accueil. Le visa de la présente convention
                ne donne lieu à aucune facturation de la part de la Chambre
                consulaire émettant la convention.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 5 – Activité Durant la période d’observation, le jeune
                participe à des activités de l’entreprise, en liaison avec les
                objectifs précisés dans les dispositions relatives aux
                conditions de réalisation du mini-stage de découverte, sous le
                contrôle des personnels responsables de leur encadrement en
                milieu professionnel. Il est soumis aux règles générales en
                vigueur dans l’entreprise ou l’organisme d’accueil, notamment en
                matière de santé, sécurité, d’horaires et de discipline. Le
                jeune est tenu au respect du secret professionnel. De même, les
                parties signataires de la convention s’engagent à mettre en
                œuvre et respecter les consignes publiées par les services de
                l’Etat, notamment pour exemple celles concernant les mesures de
                prévention des risques de contamination en matière sanitaire. En
                application des articles L 4153-8 et D 4153-15 et suivants du
                code du travail, relatif aux travaux interdits et règlementés,
                le jeune, s’il est mineur, ne peut accéder aux machines,
                appareils ou produits dont l’usage est proscrit aux mineurs. Il
                ne peut ni procéder à des manœuvres ou manipulations sur
                d’autres machines, produits ou appareils de production, ni
                effectuer les travaux légers autorisés aux mineurs par le même
                code.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 6 – Responsabilités Le chef d’entreprise prend les
                dispositions nécessaires pour garantir sa responsabilité civile
                chaque fois qu’elle sera engagée (en application de l’article
                1242 du code civil) : • soit en souscrivant une assurance
                particulière garantissant sa responsabilité civile en cas de
                faute imputable à l’entreprise ; • soit en ajoutant à son
                contrat déjà souscrit “responsabilité civile entreprise” ou
                “responsabilité civile professionnelle” un avenant relatif à
                l’accueil du jeune, si ce risque n’est pas déjà couvert. Une
                assurance couvrant la responsabilité civile du jeune est
                contractée par son représentant légal, ou le jeune lui-même s’il
                est majeur ou émancipé, pour les dommages qu’il pourrait causer
                ou subir pendant la période d’observation en milieu
                professionnel, ainsi qu’en dehors de l’entreprise, ou sur le
                trajet menant, soit au lieu où se déroule la période
                d’observation, soit au domicile.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 7 – Accident En cas d’accident survenant au jeune, soit
                en milieu professionnel, soit au cours du trajet, le responsable
                de l’entreprise, le responsable légal du jeune, ou directement
                le jeune s’il est assuré à son nom, déclarent l’accident à leurs
                assureurs respectifs dans les délais contractuels et s’engagent
                à adresser, pour information, la déclaration d’accident au
                référent de la Chambre consulaire émettant la convention.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 8 – Difficultés Le chef d’entreprise, les parents ou le
                représentant légal du jeune si celui-ci est mineur, ou le jeune
                directement si celuici est majeur, ainsi que le référent de la
                Chambre consulaire émettant la convention, se tiendront
                mutuellement informés des difficultés qui pourraient naître de
                l’application de la présente convention et prendront, d’un
                commun accord les dispositions propres à les résoudre notamment
                en cas de manquement à la discipline. Les difficultés qui
                pourraient être rencontrées lors de toute période en milieu
                professionnel et notamment toute absence du jeune, seront
                aussitôt portées à la connaissance du référent de la Chambre
                consulaire émettant la convention.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 9 – Durée La présente convention est signée pour la
                durée de la période d’observation en milieu professionnel, qui
                ne peut dépasser 5 jours.
              </p>
              <p className={fr.cx("fr-text--xs")}>
                Article 10 - Protection des données personnelles Les données
                personnelles recueillies via ce formulaire font l'objet, par le
                Responsable de traitement représenté par la Chambre consulaire
                émettant la convention, d'un traitement informatisé et/ou papier
                destiné à l’établissement de la convention de stage et à des
                fins statistiques, et sont conservées pendant une durée de cinq
                ans. Aucune information personnelle n'est cédée à quelconque
                tiers. Conformément à la loi "Informatique et Libertés" du 6
                janvier 1978 modifiée et au Règlement Général sur la Protection
                des Données, vous pouvez accéder aux données à caractère
                personnel vous concernant, les faire rectifier ou effacer après
                le délai de prescription de la fin de la convention. Vous
                disposez également du droit de limitation, de portabilité, et le
                cas échéant, d’opposition du traitement de vos données. Pour
                exercer vos droits, vous pouvez contacter le DPO (Délégué à la
                Protection des données personnelles) de la Chambre consulaire
                émettant la convention par mail en précisant la mention «
                Mini-Stage ». La politique de protection des données
                personnelles de la Chambre consulaire émettant la convention est
                détaillée dans sa charte sur son site internet. TITRE II -
                DISPOSITIONS PARTICULIÈRES La durée de la présence hebdomadaire
                des jeunes en milieu professionnel ne peut excéder 30 heures
                pour les jeunes de moins de 15 ans (6 heures par jour) et 35
                heures pour les jeunes de 15 ans et plus répartis sur 5 jours (7
                heures par jour).
              </p>
            </>
          )}
        </footer>
        <NPSForm
          mode="popup"
          formId={npsFormIds.conventionValidated}
          conventionInfos={{
            id: convention.id,
            role: jwtPayload.role,
            status: convention.status,
          }}
        />
      </Document>
    </MainWrapper>
  );
};
