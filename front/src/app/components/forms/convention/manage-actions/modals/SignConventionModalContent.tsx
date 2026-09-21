import { fr } from "@codegouvfr/react-dsfr";
import { useEffect } from "react";
import {
  getSignatoryProcessedData,
  type InternshipKind,
  type Signatory,
} from "shared";
import { useFormModal } from "src/app/utils/createFormModal";

type SignConventionModalContentProps = {
  signatory: Signatory;
  internshipKind: InternshipKind;
  onCancel: () => void;
  onSubmit?: () => void;
};

export const SignConventionModalContent = ({
  signatory,
  internshipKind,
  onCancel,
  onSubmit,
}: SignConventionModalContentProps) => {
  const { signatoryFullName, signatoryFunction } =
    getSignatoryProcessedData(signatory);

  const { modalOnCancelCallback, formId } = useFormModal();

  const onFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit();
    }
  };

  useEffect(
    () =>
      modalOnCancelCallback(() => {
        onCancel();
      }),
    [modalOnCancelCallback, onCancel],
  );

  return (
    <>
      {onSubmit && <form onSubmit={onFormSubmit} id={formId} />}
      {internshipKind === "mini-stage-cci" && (
        <p>
          Les étudiants ne sont pas soumis aux périodes de vacances scolaires
          mais ne doivent pas avoir de cours ou d'examen sur la période de
          stage.{" "}
          <strong>
            En signant cette convention, le bénéficiaire atteste être libéré de
            toutes obligations étudiantes pendant la période de stage (ni cours,
            ni examens).
          </strong>
        </p>
      )}

      <strong className={fr.cx("fr-mb-8w")}>
        Je, soussigné {signatoryFullName} ({signatoryFunction}{" "}
        {internshipKind === "immersion" ? "de l'immersion" : "du mini-stage"})
        m'engage à avoir pris connaissance des dispositions réglementaires{" "}
        {internshipKind === "immersion" ? "de la PMSMP " : "du mini-stage "}
        énoncées ci-dessous et à les respecter
      </strong>
      <div>
        <h2 className={fr.cx("fr-h4", "fr-mt-4v")}>
          {internshipKind === "immersion"
            ? "Obligations des parties :"
            : "Dispositions générales :"}
        </h2>
        {regulatoryConditionContent(internshipKind)}
      </div>
    </>
  );
};

const regulatoryConditionContent = (
  internshipKind: InternshipKind,
): JSX.Element =>
  internshipKind === "immersion" ? (
    <>
      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Le bénéficiaire (candidat)</h3>
        <p>
          Le bénéficiaire s'engage à exercer les activités et tâches telles que
          définies dans la convention et à mettre en œuvre l'ensemble des
          actions lui permettant d'atteindre les objectifs d'insertion
          socioprofessionnelle attendus, et notamment à :
        </p>
        <ul>
          <li>
            Respecter le règlement intérieur de la structure d'accueil et les
            consignes qui lui sont données et informer le conseiller référent de
            tout retard ou absence en fournissant les documents justificatifs
            requis
          </li>
          <li>
            Se conformer à l'ensemble des dispositions et mesures en matière
            d'hygiène et de sécurité applicables aux salariés dans la structure
            d'accueil, notamment en matière de port obligatoire des EPI et
            propres aux activités et tâches confiées
          </li>
          <li>
            Informer le conseiller référent de tout incident et/ou accident
          </li>
          <li>
            Informer le conseiller référent et/ou la personne responsable de son
            accueil et de son suivi des difficultés qu'il pourrait rencontrer
            dans la mise en œuvre de cette période
          </li>
          <li>
            Auto évaluer l'apport de la période de mise en situation en milieu
            professionnel dans la construction de son parcours d'insertion
            socioprofessionnelle
          </li>
        </ul>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>La structure d'accueil (entreprise)</h3>
        <p>
          La structure d'accueil s'engage à prendre l'ensemble des dispositions
          nécessaires en vue de permettre au bénéficiaire d'exercer les
          activités et tâches telles que définies dans la présente convention, à
          l'accompagner afin de lui permettre d'atteindre les objectifs
          d'insertion socioprofessionnelle attendus, et notamment à :
        </p>
        <ul>
          <li>
            Désigner une personne chargée d'accueillir, d'aider, d'informer, de
            guider et d'évaluer le bénéficiaire pendant la période de mise en
            situation en milieu professionnel
          </li>
          <li>
            Ne pas faire exécuter au bénéficiaire une tâche régulière
            correspondant à un poste de travail permanent, à un accroissement
            temporaire d'activité, à un emploi saisonnier ou au remplacement
            d'un salarié en cas d'absence ou de suspension de son contrat de
            travail
          </li>
          <li>
            S'assurer que la mise en situation en milieu professionnel respecte
            les règles applicables à ses salariés pour ce qui a trait aux durées
            quotidienne et hebdomadaire de présence, à la présence de nuit, au
            repos quotidien, hebdomadaire et aux jours fériés
          </li>
          <li>
            Etre couvert par une assurance Multirisque Professionnelle en cours
            de validité tant à l'encontre de tiers que sur des biens de la
            structure d'accueil.
          </li>
          <li>
            Mettre en œuvre toutes les dispositions nécessaires en vue de se
            conformer aux articles R.4141-3-1 et suivants du code du travail en
            matière d'information des salariés sur les règles d'hygiène et de
            sécurité applicables dans son établissement et fournir l'ensemble
            des EPI nécessaires
          </li>
          <li>
            Prévenir dès connaissance des faits, et au plus tard dans les 24
            heures, la structure d'accompagnement de tout accident survenant
            soit au cours ou sur le lieu de la mise en situation en milieu
            professionnel, soit au cours du trajet domicile-structure d'accueil
          </li>
          <li>
            Donner accès aux moyens de transport et installations collectifs
          </li>
          <li>
            Libérer, à la demande de la structure d'accompagnement, le
            bénéficiaire chaque fois que cela s'avère nécessaire
          </li>
        </ul>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>
          La structure d'accompagnement (conseiller)
        </h3>
        <p>
          La structure d'accompagnement s'engage, en la personne du conseiller
          référent, à assurer la mise en œuvre de la période de mise en
          situation en milieu professionnel et notamment à :
        </p>
        <ul>
          <li>
            Assurer l'accompagnement dans la structure d'accueil du bénéficiaire
            au travers de visites et d'entretiens sous toute forme
          </li>
          <li>
            Intervenir, à la demande de la structure d'accueil et/ou du
            bénéficiaire pour régler toute difficulté pouvant survenir pendant
            la période de mise en situation en milieu professionnel
          </li>
          <li>
            Informer sans délai l'organisme prescripteur ou, si le bénéficiaire
            est salarié, l'employeur de ce dernier, de tout accident survenant
            au cours ou sur le lieu de la mise en situation en milieu
            professionnel ou de trajet qui lui serait signalé dans le cadre de
            cette période
          </li>
          <li>
            Réaliser le bilan / évaluation de la mise en situation réalisée,
            transmis, le cas échéant, à l'organisme prescripteur
          </li>
        </ul>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>
          L'organisme prescripteur (prescripteur)
        </h3>
        <p>L'organisme prescripteur s'engage, à :</p>
        <ul>
          <li>
            Analyser la pertinence de la période de mise en situation en milieu
            professionnel proposée et d'en définir des objectifs adaptés aux
            besoins, possibilités et capacités tant du bénéficiaire que de la
            structure d'accueil
          </li>
          <li>
            Procéder à la déclaration dans les 48 heures de tout accident de
            travail ou de trajet qui lui serait signalé auprès de la Caisse
            Primaire d'Assurance Maladie du lieu de résidence du bénéficiaire
            dès lors qu'il couvre le risque AT/MP
          </li>
        </ul>
      </div>
    </>
  ) : (
    <>
      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 1 – Objet</h3>
        <p>
          La présente convention a pour objet la mise en œuvre d'une période
          d'observation en milieu professionnel, au bénéfice du jeune ci-dessus
          désigné.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 2 – Modalités particulières</h3>
        <p>
          Les objectifs et les modalités de la période d'observation sont
          consignés dans les dispositions relatives aux conditions de
          réalisation du mini-stage.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 3 – Organisation</h3>
        <p>
          L'organisation de la période d'observation est déterminée d'un commun
          accord entre les parties ci-dessus désignées, avec le concours de la
          Chambre consulaire concernée.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 4 – Conditions financières</h3>
        <p>
          Durant la période d'observation en milieu professionnel, le jeune ne
          peut prétendre à aucune rémunération ou gratification de l'entreprise
          ou de l'organisme d'accueil. Le visa de la présente convention ne
          donne lieu à aucune facturation de la part de la Chambre consulaire
          émettant la convention.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 5 – Activité</h3>
        <p>
          Durant la période d'observation, le jeune participe à des activités de
          l'entreprise, en liaison avec les objectifs précisés dans les
          dispositions relatives aux conditions de réalisation du mini-stage de
          découverte, sous le contrôle des personnels responsables de leur
          encadrement en milieu professionnel. personnels responsables de leur
          encadrement en milieu professionnel. Il est soumis aux règles
          générales en vigueur dans l'entreprise ou l'organisme d'accueil,
          notamment en matière de santé, sécurité, d'horaires et de discipline.
          Le jeune est tenu au respect du secret professionnel. De même, les
          parties signataires de la convention s'engagent à mettre en œuvre et
          respecter les consignes publiées par les services de l'Etat, notamment
          pour exemple celles concernant les mesures de prévention des risques
          de contamination en matière sanitaire. En application des articles L
          4153-8 et D 4153-15 et suivants du code du travail, relatif aux
          travaux interdits et règlementés, le jeune, s'il est mineur, ne peut
          accéder aux machines, appareils ou produits dont l'usage est proscrit
          aux mineurs. Il ne peut ni procéder à des manœuvres ou manipulations
          sur d'autres machines, produits ou appareils de production, ni
          effectuer les travaux légers autorisés aux mineurs par le même code.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 6 – Responsabilités</h3>
        <p>
          Le chef d'entreprise prend les dispositions nécessaires pour garantir
          sa responsabilité civile chaque fois qu'elle sera engagée (en
          application de l'article 1242 du code civil) : • soit en souscrivant
          une assurance particulière garantissant sa responsabilité civile en
          cas de faute imputable à l'entreprise ; • soit en ajoutant à son
          garantissant sa responsabilité civile en cas de faute imputable à
          l'entreprise ; • soit en ajoutant à son contrat déjà souscrit
          "responsabilité civile entreprise" ou "responsabilité civile
          professionnelle" un avenant relatif à l'accueil du jeune, si ce risque
          n'est pas déjà couvert. Une assurance couvrant la responsabilité
          civile du jeune est contractée par son représentant légal, ou le jeune
          lui-même s'il est majeur ou émancipé, pour les dommages qu'il pourrait
          causer ou subir pendant la période d'observation en milieu
          professionnel, ainsi qu'en dehors de l'entreprise, ou sur le trajet
          menant, soit au lieu où se déroule la période d'observation, soit au
          domicile.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 7 – Accident</h3>
        <p>
          En cas d'accident survenant au jeune, soit en milieu professionnel,
          soit au cours du trajet, le responsable de l'entreprise, le
          responsable légal du jeune, ou directement le jeune s'il est assuré à
          son nom, déclarent l'accident à leurs assureurs respectifs dans les
          délais contractuels et s'engagent à adresser, pour information, la
          déclaration d'accident au référent de la Chambre consulaire émettant
          la convention.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 8 – Difficultés</h3>
        <p>
          Le chef d'entreprise, les parents ou le représentant légal du jeune si
          celui-ci est mineur, ou le jeune directement si celuici est majeur,
          ainsi que le référent de la Chambre consulaire émettant la convention,
          se tiendront mutuellement informés des difficultés qui pourraient
          naître de l'application de la présente convention et prendront, d'un
          commun accord les dispositions propres à les résoudre notamment en cas
          de manquement à la discipline. Les difficultés qui pourraient être
          rencontrées lors de toute période en milieu professionnel et notamment
          toute absence du jeune, seront aussitôt portées à la connaissance du
          référent de la Chambre consulaire émettant la convention.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>Article 9 – Durée</h3>
        <p>
          La présente convention est signée pour la durée de la période
          d'observation en milieu professionnel, qui ne peut dépasser 5 jours.
        </p>
      </div>

      <div className={fr.cx("fr-mb-5v")}>
        <h3 className={fr.cx("fr-h6")}>
          Article 10 – Protection des données personnelles
        </h3>
        <p>
          Les données personnelles recueillies via ce formulaire font l'objet,
          par le Responsable de traitement représenté par la Chambre consulaire
          émettant la convention, d'un traitement informatisé et/ou papier
          destiné à l'établissement de la convention de stage et à des fins
          statistiques, et sont conservées pendant une durée de cinq ans. Aucune
          information personnelle n'est cédée à quelconque tiers. Conformément à
          la loi "Informatique et Libertés" du 6 janvier 1978 modifiée et au
          Règlement Général sur la Protection des Données, vous pouvez accéder
          aux données à caractère personnel vous concernant, les faire rectifier
          ou effacer après le délai de prescription de la fin de la convention.
          Vous disposez également du droit de limitation, de portabilité, et le
          cas échéant, d'opposition du traitement de vos données. Pour exercer
          vos droits, vous pouvez contacter le DPO (Délégué à la Protection des
          données personnelles) de la Chambre consulaire émettant la convention
          concernée par mail en précisant la mention « Mini-Stage ». La
          politique de protection des données personnelles de la Chambre
          consulaire est détaillée dans sa charte sur son site internet. TITRE
          II - DISPOSITIONS PARTICULIÈRES La durée de la présence hebdomadaire
          des jeunes en milieu professionnel ne peut excéder 30 heures pour les
          jeunes de moins de 15 ans (6 heures par jour) et 35 heures pour les
          jeunes de 15 ans et plus répartis sur 5 jours (7 heures par jour).
        </p>
      </div>
    </>
  );
