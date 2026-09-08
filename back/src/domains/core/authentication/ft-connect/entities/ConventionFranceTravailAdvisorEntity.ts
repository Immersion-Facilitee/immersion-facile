import type { FtConnectImmersionAdvisorDto } from "shared";
import { createLogger } from "../../../../../utils/logger";
import type { FtConnectAdvisorDto } from "../dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../dto/FtConnectUserDto";

const preferCapEmploiPredicate = (
  a: FtConnectImmersionAdvisorDto,
  _: FtConnectImmersionAdvisorDto,
) => (a.type === "CAPEMPLOI" ? -1 : 1);

export const onlyValidAdvisorsForImmersion = (
  advisor: FtConnectAdvisorDto,
): advisor is FtConnectImmersionAdvisorDto => advisor.type !== "INDEMNISATION";

const logger = createLogger(__filename);

export const chooseValidAdvisor = (
  { ftExternalId }: FtConnectUserDto,
  advisors: FtConnectAdvisorDto[],
): FtConnectImmersionAdvisorDto | undefined => {
  const sortedValidAdvisors: FtConnectImmersionAdvisorDto[] = advisors
    .filter(onlyValidAdvisorsForImmersion)
    .sort(preferCapEmploiPredicate);

  const preferredAdvisor = sortedValidAdvisors.at(0);
  if (!preferredAdvisor) {
    logger.error({
      ftConnect: {
        ftExternalId,
      },
      message: "getAdvisorsInfo - ftConnectNoValidAdvisor",
    });
    return undefined;
  }

  return preferredAdvisor;
};
