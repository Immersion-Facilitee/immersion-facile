import { fr } from "@codegouvfr/react-dsfr";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Input from "@codegouvfr/react-dsfr/Input";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type EstablishmentFormOffer,
  MAX_1024_TEXT_INPUT,
  type OmitFromExistingKeys,
  type RemoteWorkMode,
  remoteWorkModeLabels,
  remoteWorkModes,
} from "shared";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";
import { offerFieldsContent } from "src/app/contents/forms/establishment/formEstablishment";
import type { Mode } from "src/app/routes/routes.hooks";
import { appellationSlice } from "src/core-logic/domain/appellation/appellation.slice";
import type { $ZodIssue } from "zod/v4/core";

export type CurrentOffer = OmitFromExistingKeys<
  EstablishmentFormOffer,
  "remoteWorkMode"
> & {
  remoteWorkMode?: RemoteWorkMode;
};

export const emptyOffer: CurrentOffer = {
  appellationCode: "",
  appellationLabel: "",
  romeCode: "",
  romeLabel: "",
  remoteWorkMode: undefined,
};

type OfferFieldsErrors = {
  hasAppellationError: boolean;
  hasRemoteWorkModeError: boolean;
  immersionActivitiesErrorMessage?: string;
};

type OfferFieldsProps<T extends CurrentOffer> = OfferFieldsErrors & {
  mode: Mode;
  offer: T;
  onOfferChange: (offer: T) => void;
};

const appellationFields: (keyof EstablishmentFormOffer)[] = [
  "appellationCode",
  "appellationLabel",
  "romeCode",
  "romeLabel",
];

type OfferSection = "job" | "immersionActivities";

const dsfrDisclosureEvents = ["dsfr.disclose", "dsfr.conceal"];

const useKeepDsfrDisclosureEventsInside = (
  containerRef: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stopPropagation = (event: Event) => event.stopPropagation();
    dsfrDisclosureEvents.forEach((eventName) => {
      container.addEventListener(eventName, stopPropagation);
    });
    return () => {
      dsfrDisclosureEvents.forEach((eventName) => {
        container.removeEventListener(eventName, stopPropagation);
      });
    };
  }, [containerRef]);
};

const OfferSectionLabel = ({
  title,
  badge,
}: {
  title: string;
  badge: ReactNode;
}): ReactNode => (
  <span className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-col")}>
    <span className={fr.cx("fr-col")}>{title}</span>
    <span className={fr.cx("fr-mr-2w")}>{badge}</span>
  </span>
);

export const offerFieldsErrorsFromIssues = (
  issues: $ZodIssue[],
): OfferFieldsErrors => ({
  hasAppellationError: issues.some((issue) =>
    appellationFields.some((field) => issue.path.join(".") === field),
  ),
  hasRemoteWorkModeError: issues.some(
    (issue) => issue.path.join(".") === "remoteWorkMode",
  ),
  immersionActivitiesErrorMessage: issues.find(
    (issue) => issue.path.join(".") === "immersionActivities",
  )?.message,
});

export const OfferFields = <T extends CurrentOffer>({
  mode,
  offer,
  onOfferChange,
  hasAppellationError,
  hasRemoteWorkModeError,
  immersionActivitiesErrorMessage,
}: OfferFieldsProps<T>): ReactNode => {
  const dispatch = useDispatch();
  const initialOffer = useRef(offer).current;
  const accordionsGroupRef = useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = useState<OfferSection | null>(
    "job",
  );
  const hasJobSectionError = hasAppellationError || hasRemoteWorkModeError;
  const ids = domElementIds.formEstablishment[mode];

  useKeepDsfrDisclosureEventsInside(accordionsGroupRef);

  useEffect(() => {
    if (hasJobSectionError) return setExpandedSection("job");
    if (immersionActivitiesErrorMessage)
      setExpandedSection("immersionActivities");
  }, [hasJobSectionError, immersionActivitiesErrorMessage]);

  const makeAccordionExpansionProps = (section: OfferSection) => ({
    expanded: expandedSection === section,
    onExpandedChange: (expanded: boolean) =>
      setExpandedSection(expanded ? section : null),
  });

  useEffect(() => {
    if (initialOffer.appellationCode)
      dispatch(
        appellationSlice.actions.selectSuggestionRequested({
          item: {
            appellationCode: initialOffer.appellationCode,
            appellationLabel: initialOffer.appellationLabel,
            romeCode: initialOffer.romeCode,
            romeLabel: initialOffer.romeLabel,
          },
          locator: "form-establishment-offer-modal",
        }),
      );
    return () => {
      dispatch(
        appellationSlice.actions.clearLocatorDataRequested({
          locator: "form-establishment-offer-modal",
        }),
      );
    };
  }, [dispatch, initialOffer]);

  return (
    <>
      <Alert
        id={ids.offerOptionalPartsAlert}
        severity="info"
        closable
        title={offerFieldsContent.optionalPartsAlert.title}
        description={offerFieldsContent.optionalPartsAlert.description}
        className={fr.cx("fr-mb-4w")}
      />
      <div ref={accordionsGroupRef} className={fr.cx("fr-accordions-group")}>
        <Accordion
          id={ids.offerJobAccordion}
          label={
            <OfferSectionLabel
              title={offerFieldsContent.jobSectionTitle}
              badge={
                <Badge severity="warning" small noIcon>
                  {offerFieldsContent.requiredBadge}
                </Badge>
              }
            />
          }
          {...makeAccordionExpansionProps("job")}
        >
          <AppellationAutocomplete
            label="Métier proposé"
            locator="form-establishment-offer-modal"
            selectProps={{
              inputId: ids.appellations,
            }}
            initialInputValue={initialOffer.appellationLabel || undefined}
            onAppellationSelected={(appellation) =>
              onOfferChange({
                ...offer,
                appellationCode: appellation.appellationCode,
                appellationLabel: appellation.appellationLabel,
                romeCode: appellation.romeCode,
                romeLabel: appellation.romeLabel,
              })
            }
            onAppellationClear={() =>
              onOfferChange({
                ...offer,
                appellationCode: "",
                appellationLabel: "",
                romeCode: "",
                romeLabel: "",
              })
            }
            stateRelatedMessage={
              hasAppellationError ? (
                "Le métier sélectionné semble invalide"
              ) : (
                <>
                  Les métiers sont basés sur la&nbsp;
                  <a
                    id={ids.appellationsListLink}
                    href="https://candidat.francetravail.fr/metierscope/metiers"
                    target="_blank"
                    rel="noreferrer"
                  >
                    liste officielle de France Travail
                  </a>
                </>
              )
            }
            state={hasAppellationError ? "error" : "info"}
          />
          <RadioButtons
            legend="Proposez-vous du télétravail sur ce métier ?"
            id={ids.remoteWorkMode}
            options={remoteWorkModes.map((remoteWorkMode) => ({
              label: remoteWorkModeLabels[remoteWorkMode].answerLabel,
              nativeInputProps: {
                value: remoteWorkMode,
                checked: offer.remoteWorkMode === remoteWorkMode,
                onChange: () => onOfferChange({ ...offer, remoteWorkMode }),
              },
            }))}
            state={hasRemoteWorkModeError ? "error" : "default"}
            stateRelatedMessage={
              hasRemoteWorkModeError
                ? "Le mode de travail sélectionné semble invalide"
                : undefined
            }
          />
        </Accordion>
        <Accordion
          id={ids.offerImmersionActivitiesAccordion}
          label={
            <OfferSectionLabel
              title={offerFieldsContent.immersionActivitiesSectionTitle}
              badge={
                <Badge small noIcon>
                  {offerFieldsContent.optionalBadge}
                </Badge>
              }
            />
          }
          {...makeAccordionExpansionProps("immersionActivities")}
        >
          <Input
            textArea
            label={offerFieldsContent.immersionActivitiesLabel}
            hintText={offerFieldsContent.immersionActivitiesHint}
            nativeTextAreaProps={{
              id: ids.immersionActivities,
              value: offer.immersionActivities ?? "",
              maxLength: MAX_1024_TEXT_INPUT,
              onChange: (event) =>
                onOfferChange({
                  ...offer,
                  immersionActivities: event.currentTarget.value,
                }),
            }}
            state={immersionActivitiesErrorMessage ? "error" : "default"}
            stateRelatedMessage={immersionActivitiesErrorMessage}
          />
        </Accordion>
      </div>
    </>
  );
};
