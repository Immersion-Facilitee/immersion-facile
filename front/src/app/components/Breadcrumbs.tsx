import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { slice } from "ramda";
import { useRoute } from "shared";
import {
  type BreadcrumbsRoutesParams,
  getBreadcrumbs,
} from "src/app/contents/breadcrumbs/breadcrumbs";

export const Breadcrumbs = ({
  breadcrumbsRoutesParams,
}: {
  breadcrumbsRoutesParams?: BreadcrumbsRoutesParams;
}) => {
  const { name: currentRouteName } = useRoute();
  if (!currentRouteName) return null;
  const segments = getBreadcrumbs({
    currentRouteKey: currentRouteName,
    routesParams: breadcrumbsRoutesParams,
  });
  if (segments.length <= 1) return null;
  const ancestors = slice(0, -1, segments);
  return (
    <div className={fr.cx("fr-container", "fr-mt-4w")}>
      <Breadcrumb
        className={fr.cx("fr-mb-0")}
        segments={ancestors}
        currentPageLabel={segments[segments.length - 1].label}
      />
    </div>
  );
};
