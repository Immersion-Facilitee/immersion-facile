import { frontRoutes, useRoute } from "shared";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { Route } from "type-route";

type CurrentRoute = ReturnType<typeof useRoute>;
type CurrentRouteName = Exclude<CurrentRoute["name"], false>;
type RouteByName<TRouteName extends CurrentRouteName> = Extract<
  CurrentRoute,
  { name: TRouteName }
>;
type EnsureRouteNamesMatchUnion<
  TRouteName extends CurrentRouteName,
  TRouteNames extends readonly TRouteName[],
> =
  Exclude<TRouteName, TRouteNames[number]> extends never ? TRouteNames : never;

const isRouteAmong = <TRouteName extends CurrentRouteName>(
  route: CurrentRoute,
  routeNames: readonly TRouteName[],
): route is RouteByName<TRouteName> =>
  routeNames.some((routeName) => routeName === route.name);

const useTypedRoute = <
  TRouteName extends CurrentRouteName,
  const TRouteNames extends readonly TRouteName[],
>(
  routeNames: EnsureRouteNamesMatchUnion<TRouteName, TRouteNames>,
): RouteByName<TRouteName> => {
  const route = useRoute();
  if (isRouteAmong(route, routeNames)) return route;
  throw frontErrors.generic.wrongRoute({
    supportedRoutes: routeNames.map((routeName) => routeName.toString()),
    originalRoute: route.name.toString(),
  });
};

export const makeUseTypedRoute =
  <TRouteName extends CurrentRouteName>() =>
  <const TRouteNames extends readonly TRouteName[]>(
    routeNames: EnsureRouteNamesMatchUnion<TRouteName, TRouteNames>,
  ) =>
    useTypedRoute<TRouteName, TRouteNames>(routeNames);

type ConventionRouteName =
  | (typeof frontRoutes.conventionImmersion)["name"]
  | (typeof frontRoutes.conventionMiniStage)["name"]
  | (typeof frontRoutes.conventionImmersionForExternals)["name"]
  | (typeof frontRoutes.conventionTemplate)["name"];

const conventionRouteNames = [
  frontRoutes.conventionImmersion.name,
  frontRoutes.conventionMiniStage.name,
  frontRoutes.conventionImmersionForExternals.name,
  frontRoutes.conventionTemplate.name,
] as const;

const useConventionTypedRoute = makeUseTypedRoute<ConventionRouteName>();

export const useConventionRoute = () =>
  useConventionTypedRoute(conventionRouteNames);

export type RouteByMode = {
  create: Route<typeof frontRoutes.formEstablishment>;
  edit: Route<typeof frontRoutes.establishmentDashboardFormEstablishment>;
  admin: Route<typeof frontRoutes.adminEstablishments>;
};

export type Mode = keyof RouteByMode;

type EstablishmentRouteName = RouteByMode[Mode]["name"];

const establishmentRouteNames = [
  frontRoutes.formEstablishment.name,
  frontRoutes.establishmentDashboardFormEstablishment.name,
  frontRoutes.adminEstablishments.name,
] as const;

const useEstablishmentTypedRoute = makeUseTypedRoute<EstablishmentRouteName>();

export const useEstablishmentRoute = () =>
  useEstablishmentTypedRoute(establishmentRouteNames);

export const useSearchResultRoute =
  makeUseTypedRoute<
    (
      | typeof frontRoutes.searchResult
      | typeof frontRoutes.searchResultForStudent
      | typeof frontRoutes.searchResultExternal
    )["name"]
  >();

type CreateDiscussionRouteName = (
  | typeof frontRoutes.searchResult
  | typeof frontRoutes.searchResultForStudent
)["name"];

const createDiscussionRouteNames = [
  frontRoutes.searchResult.name,
  frontRoutes.searchResultForStudent.name,
] as const;

const useCreateDiscussionTypedRoute =
  makeUseTypedRoute<CreateDiscussionRouteName>();

export const useCreateDiscussionRoute = () =>
  useCreateDiscussionTypedRoute(createDiscussionRouteNames);
