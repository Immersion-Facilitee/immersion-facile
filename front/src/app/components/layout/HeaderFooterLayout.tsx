import type { ReactNode } from "react";
import { type SkipLink, SkipLinks } from "react-design-system";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import type { BreadcrumbsRoutesParams } from "src/app/contents/breadcrumbs/breadcrumbs";
import { LayoutFooter } from "./LayoutFooter";
import { LayoutHeader } from "./LayoutHeader";

const skipLinks: SkipLink[] = [
  {
    label: "Contenu principal",
    anchor: "main-content",
  },
  {
    label: "Aide et contact",
    anchor: "over-footer",
  },
  {
    label: "Pied de page",
    anchor: "main-footer",
  },
];
type HeaderFooterLayoutProps = {
  children: ReactNode;
  isBreadcrumbsDisplayed?: boolean;
  breadcrumbsRoutesParams?: BreadcrumbsRoutesParams;
};

export const HeaderFooterLayout = ({
  children,
  isBreadcrumbsDisplayed = true,
  breadcrumbsRoutesParams,
}: HeaderFooterLayoutProps) => (
  <>
    <SkipLinks links={skipLinks} />
    <LayoutHeader />
    {isBreadcrumbsDisplayed && (
      <Breadcrumbs breadcrumbsRoutesParams={breadcrumbsRoutesParams} />
    )}
    {children}
    <LayoutFooter />
  </>
);
