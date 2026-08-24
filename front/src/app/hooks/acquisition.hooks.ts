import { equals, values } from "ramda";
import { useEffect, useState } from "react";
import type { acquisitionParams, WithAcquisition } from "shared";
import { getUrlParameters } from "src/app/utils/url.utils";
import { outOfReduxDependencies } from "src/config/dependencies";

type AcquisitionParams = Record<keyof typeof acquisitionParams, string>;
type UrlParamsWithAcquisition = Record<string, string> & AcquisitionParams;

const routeParamsContainsAcquisitionParams = (
  routeParams: Record<string, string>,
): routeParams is UrlParamsWithAcquisition =>
  ("at_campaign" in routeParams && routeParams.at_campaign !== undefined) ||
  ("at_kwd" in routeParams && routeParams.at_kwd !== undefined);

const areRouteParamsDifferentFromAcquisitionParams = (
  acquisitionParams: WithAcquisition,
  routeParams: UrlParamsWithAcquisition,
) =>
  !equals(
    values(acquisitionParams).filter((param) => param !== undefined),
    values({
      at_campaign: routeParams.at_campaign,
      at_kwd: routeParams.at_kwd,
    }).filter((param) => param !== undefined),
  );

export const useSetAcquisitionParams = (): WithAcquisition => {
  const acquisitionParams = useGetAcquisitionParams();
  useEffect(() => {
    outOfReduxDependencies.sessionDeviceRepository.set(
      "acquisitionParams",
      acquisitionParams,
    );
  }, [acquisitionParams]);

  return acquisitionParams;
};

export const useGetAcquisitionParams = () => {
  const urlParams = getUrlParameters(window.location);
  const initialParams =
    outOfReduxDependencies.sessionDeviceRepository.get("acquisitionParams");
  const initialAcquisitionParams = initialParams ?? {
    acquisitionCampaign: "",
    acquisitionKeyword: "",
  };
  const [acquisitionParams, setAcquisitionParams] = useState<WithAcquisition>(
    initialAcquisitionParams,
  );
  if (
    routeParamsContainsAcquisitionParams(urlParams) &&
    areRouteParamsDifferentFromAcquisitionParams(acquisitionParams, urlParams)
  ) {
    setAcquisitionParams({
      acquisitionCampaign: urlParams.at_campaign,
      acquisitionKeyword: urlParams.at_kwd,
    });
  }
  return acquisitionParams;
};
