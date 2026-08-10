import { type AbsoluteUrl, frontRoutes, makeRouteAbsoluteUrl } from "shared";
import type { AppConfig } from "../bootstrap/appConfig";

export type RedirectErrorUrlParams = {
  title?: string;
  kind?: string;
  message?: string;
};

export const makeRedirectErrorUrl = (
  params: RedirectErrorUrlParams,
  config: AppConfig,
): AbsoluteUrl =>
  makeRouteAbsoluteUrl({
    route: frontRoutes.temporaryError(params),
    baseUrl: config.immersionFacileBaseUrl,
  });
