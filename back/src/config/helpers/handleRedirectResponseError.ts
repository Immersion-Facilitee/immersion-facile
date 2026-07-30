import type { Response } from "express";
import type { AbsoluteUrl, FTConnectError } from "shared";

type RawRedirectErrorParams = {
  title: string;
  message: string;
};

const toRawRedirectErrorParams = (
  error: FTConnectError,
): RawRedirectErrorParams => ({
  title: error.title,
  message: error.message,
});

export type RedirectErrorUrlParams = {
  title?: string;
  kind?: string;
};

export const makeHandleManagedRedirectResponseError =
  (redirectErrorUrl: (params: RedirectErrorUrlParams) => AbsoluteUrl) =>
  (res: Response): void => {
    res.redirect(redirectErrorUrl({}));
  };

export const makeHandleRawRedirectResponseError =
  (redirectErrorUrl: (params: RawRedirectErrorParams) => AbsoluteUrl) =>
  (error: FTConnectError, res: Response) => {
    res.redirect(redirectErrorUrl(toRawRedirectErrorParams(error)));
  };
