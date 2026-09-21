import { fr } from "@codegouvfr/react-dsfr";
import { Badge, type BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import type { ReactNode } from "react";
import { useStyles } from "tss-react/dsfr";
import {
  type AgencySubSection,
  ConventionAgencySubSection,
} from "../convention-agency-sub-section/ConventionAgencySubSection";
import { CopyButton } from "../copy-button/CopyButton";
import { conventionSummaryStyles } from "./ConventionSummary.styles";

export type { AgencySubSection } from "../convention-agency-sub-section/ConventionAgencySubSection";

export type ConventionSummaryProperties = {
  conventionId?: string;
  submittedAt: string;
  summary: ConventionSummarySection[];
  illustration: string;
  agencySubSection: AgencySubSection;
};

export type ConventionSummarySection = {
  title: string;
  subSections: ConventionSummarySubSection[];
};

export type ConventionSummarySubSection = {
  key: string;
  header?: {
    title: string;
    badge?: BadgeProps;
    action?: ButtonProps;
  };
  fields: ConventionSummaryField[];
  isFullWidthDisplay?: boolean;
  hasBackgroundColor?: boolean;
  isSchedule?: boolean;
};

export type ConventionSummaryField = { key: string } & (
  | {
      label: string;
      value: string | NonNullable<ReactNode>;
      copyButton?: string | ReactNode;
      hasBackgroundColor?: boolean;
    }
  | BadgeProps
  | { value: NonNullable<ReactNode> }
);

export const ConventionSummary = ({
  conventionId,
  submittedAt,
  summary,
  illustration,
  agencySubSection,
}: ConventionSummaryProperties) => {
  const { cx } = useStyles();

  const isNextSubsectionFullwidth = (
    subsections: ConventionSummarySubSection[],
    index: number,
  ): boolean => {
    const nextSubsection = subsections[index + 1];

    if (!nextSubsection) return false;
    return !!nextSubsection.isFullWidthDisplay;
  };

  return (
    <>
      {conventionId && (
        <section
          className={cx(
            fr.cx("fr-grid-row", "fr-mb-3w", "fr-p-2w"),
            conventionSummaryStyles.section,
            conventionSummaryStyles.sectionHeader,
          )}
        >
          <div className={fr.cx("fr-col-12", "fr-col-md-1")}>
            <img src={illustration} alt="" />
          </div>

          <div
            className={cx(
              fr.cx("fr-col-12", "fr-col-md-11", "fr-grid-row"),
              conventionSummaryStyles.sectionHeaderMain,
            )}
          >
            <div
              className={fr.cx("fr-col-12", "fr-col-md-8")}
              itemScope
              itemType="https://schema.org/Thing"
            >
              <h2 className={fr.cx("fr-mb-0", "fr-h4")}>Convention</h2>
              <div className={fr.cx("fr-text--xs", "fr-mb-2v")}>
                <span>
                  Date de soumission :{" "}
                  <time
                    itemProp="dateSubmitted"
                    dateTime={convertFrenchDateToIsoDate(submittedAt)}
                  >
                    {submittedAt}
                  </time>
                </span>
              </div>
              <dl>
                <dt className={cx(conventionSummaryStyles.sectionId)}>ID : </dt>
                <dd itemProp="identifier" content={conventionId}>
                  {conventionId}
                </dd>
              </dl>
            </div>
            <CopyButton
              label="Copier l'ID de convention"
              textToCopy={conventionId}
              withIcon={true}
              className={fr.cx("fr-my-2v")}
              priority="tertiary"
            />
          </div>
        </section>
      )}
      {summary.map((section, sectionIndex) => (
        <section
          className={cx(
            fr.cx("fr-mb-3w", "fr-p-2w"),
            conventionSummaryStyles.section,
          )}
          key={section.title}
        >
          <h2 className={fr.cx("fr-mt-3v", "fr-mb-2v", "fr-mb-0", "fr-h4")}>
            {section.title}
          </h2>
          <div className={fr.cx("fr-grid-row")}>
            {section.subSections.map((subSection, index) => (
              <SubSection
                key={subSection.key}
                subSection={subSection}
                index={index}
                isNextSubsectionFullwidth={isNextSubsectionFullwidth(
                  section.subSections,
                  index,
                )}
              />
            ))}
          </div>
          {sectionIndex === 0 && (
            <ConventionAgencySubSection {...agencySubSection} />
          )}
        </section>
      ))}
    </>
  );
};

const SubSection = ({
  subSection,
  index,
  isNextSubsectionFullwidth,
}: {
  subSection: ConventionSummarySubSection;
  index: number;
  isNextSubsectionFullwidth: boolean;
}) => {
  const { cx } = useStyles();

  return (
    <>
      {shouldDisplayHorizontalSeparator(
        index,
        !!subSection.hasBackgroundColor,
        !!subSection.isFullWidthDisplay,
      ) && (
        <div
          className={cx(
            fr.cx("fr-my-2w"),
            conventionSummaryStyles.subsectionHorizontalSeparator,
          )}
        />
      )}
      <section
        key={subSection.header?.title}
        className={cx(
          fr.cx(
            "fr-col-12",
            !!subSection.header?.title && "fr-py-2w",
            !subSection.isFullWidthDisplay && "fr-col-md-6",
            subSection.hasBackgroundColor && "fr-p-2w",
            index % 2 === 0 && "fr-pr-3w",
          ),
          conventionSummaryStyles.subsection,
          subSection.hasBackgroundColor &&
            conventionSummaryStyles.subsectionHighlighted,
          shouldDisplayVerticalSeparator(
            index,
            !!subSection.isFullWidthDisplay,
            isNextSubsectionFullwidth,
          ) && conventionSummaryStyles.subsectionVerticalSeparator,
        )}
      >
        <div className={cx(conventionSummaryStyles.subsectionElementFullWidth)}>
          {subSection.header && (
            <div
              className={cx(
                fr.cx("fr-grid-row"),
                conventionSummaryStyles.subsectionHeaderItems,
              )}
            >
              <div>
                {subSection.header?.title && (
                  <h3 className={fr.cx("fr-mb-2v", "fr-h6")}>
                    {subSection.header.title}
                  </h3>
                )}
                {subSection.header?.badge && (
                  <div className={fr.cx("fr-col-12", "fr-mb-1w")}>
                    <Badge small {...subSection.header.badge} />
                  </div>
                )}
              </div>
              {subSection.header.action && (
                <div className={cx(fr.cx("fr-mr-md-2w", "fr-mb-2w"))}>
                  <Button size="small" {...subSection.header.action} />
                </div>
              )}
            </div>
          )}
          {subSection.isSchedule && <Schedule fields={subSection.fields} />}
          {!subSection.isSchedule && (
            <div className={fr.cx("fr-grid-row")}>
              {subSection.fields.map((field) => {
                if ("severity" in field) {
                  return (
                    <div
                      key={field.key}
                      className={cx(
                        conventionSummaryStyles.subsectionElementFullWidth,
                      )}
                    >
                      <Badge small {...field} />
                    </div>
                  );
                }
                return (
                  <div
                    className={fr.cx("fr-col-12", "fr-col-md-6", "fr-my-1w")}
                    key={field.key}
                  >
                    {"label" in field && (
                      <dl>
                        <dt className={fr.cx("fr-text--xs", "fr-m-0")}>
                          {field.label}
                        </dt>
                        <dd
                          className={cx(
                            fr.cx("fr-text--sm", "fr-m-0", "fr-mr-2w"),
                            conventionSummaryStyles.subsectionValue,
                          )}
                          id={`${conventionSummaryStyles.subsectionValue}-${field.key}`}
                        >
                          {field.value}
                          {field.copyButton}
                        </dd>
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

const Schedule = ({ fields }: { fields: ConventionSummaryField[] }) => {
  const schedule = fields[0];
  if (!schedule || !("value" in schedule)) return null;
  return <>{schedule.value}</>;
};

const shouldDisplayHorizontalSeparator = (
  index: number,
  hasBackgroundColor: boolean,
  isFullWidthDisplay: boolean,
) => {
  if (hasBackgroundColor) return false;
  if (isFullWidthDisplay) return true;
  return index % 2 === 0;
};

const shouldDisplayVerticalSeparator = (
  index: number,
  isFullWidthDisplay: boolean,
  isNextSubsectionFullWidth: boolean,
) => {
  if (isFullWidthDisplay || isNextSubsectionFullWidth) return false;
  return index % 2 === 0;
};

export const convertFrenchDateToIsoDate = (date: string) => {
  const splittedDate = date.split("/");
  return new Date(
    `${splittedDate[2]}-${splittedDate[1]}-${splittedDate[0]}T00:00`,
  ).toISOString();
};
