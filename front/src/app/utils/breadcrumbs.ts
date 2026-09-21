import type { BreadcrumbProps } from "@codegouvfr/react-dsfr/Breadcrumb";
import { flatten, keys } from "ramda";
import { isFunction } from "shared";
import type {
  Breadcrumbs,
  BreadcrumbsItem,
} from "src/app/contents/breadcrumbs/breadcrumbs";
import type { Route } from "type-route";

type RoutesKeysFromBreadcrumbs<T extends Record<keyof T, BreadcrumbsItem>> = {
  [K in keyof T]:
    | K
    | (T[K]["children"] extends Record<keyof T[K]["children"], BreadcrumbsItem>
        ? RoutesKeysFromBreadcrumbs<T[K]["children"]>
        : never);
}[keyof T];

export const makeBreadcrumbsSegments =
  <T extends Record<string, BreadcrumbsItem>>(
    breadcrumbsSet: Breadcrumbs<keyof T extends string ? keyof T : never>,
    rootAncestor: BreadcrumbProps["segments"][0],
  ) =>
  ({
    currentRouteKey,
  }: {
    currentRouteKey: RoutesKeysFromBreadcrumbs<T>;
  }): BreadcrumbProps["segments"] => {
    const currentRouteAncestor = keys(breadcrumbsSet).find((key) => {
      const currentRouteInBreadcrumbs = breadcrumbsSet[key];
      if (!currentRouteInBreadcrumbs) return false;
      return (
        currentRouteInBreadcrumbs.route.name === currentRouteKey ||
        isRouteInChildren(currentRouteKey, currentRouteInBreadcrumbs)
      );
    });
    return [
      rootAncestor,
      ...(currentRouteAncestor && breadcrumbsSet[currentRouteAncestor]
        ? formatToBreadcrumbsSegments(
            breadcrumbsSet[currentRouteAncestor],
            currentRouteKey,
          )
        : []),
    ];
  };

const isRouteInChildren = <T>(
  currentRouteKey: T,
  breadcrumbsItem: BreadcrumbsItem,
): boolean => {
  const children = breadcrumbsItem.children;
  if (!children) return false;
  return keys(children).some((key) => {
    const child = children[key];
    if (!child) return false;
    if (getRoute(child.route).name === currentRouteKey) return true;
    if (child.children) {
      return isRouteInChildren(currentRouteKey, child);
    }
  });
};

const formatToBreadcrumbsSegments = <T>(
  ancestor: BreadcrumbsItem,
  currentRouteKey: T,
): BreadcrumbProps["segments"] => {
  const { label, route, children } = ancestor;
  const ancestorSegment = {
    label,
    linkProps: getRoute(route).link,
  };
  if (!children || ancestor.route.name === currentRouteKey)
    return [ancestorSegment];
  const childSegments = flatten(
    keys(children).map((key) => {
      const child = children[key];

      if (!child) return;

      const { route, label, children: childChildren } = child;
      const { name: routeName, link: linkProps } = getRoute(route);

      if (
        isRouteInChildren(currentRouteKey, child) &&
        routeName !== currentRouteKey &&
        childChildren
      ) {
        return formatToBreadcrumbsSegments(child, currentRouteKey);
      }
      if (routeName !== currentRouteKey) return;

      return {
        label,
        linkProps,
      };
    }),
  ).filter((child) => child !== undefined);
  return [ancestorSegment, ...childSegments];
};

const getRoute = <T>(route: Route<T> | (() => Route<T>)): Route<T> =>
  isFunction(route) ? route() : route;
