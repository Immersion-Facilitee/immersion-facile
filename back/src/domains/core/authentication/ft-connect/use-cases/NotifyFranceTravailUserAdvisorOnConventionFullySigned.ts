import {
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import { useCaseBuilder } from "../../../useCaseBuilder";

export type NotifyFranceTravailUserAdvisorOnConventionFullySigned = ReturnType<
  typeof makeNotifyFranceTravailUserAdvisorOnConventionFullySigned
>;

export const makeNotifyFranceTravailUserAdvisorOnConventionFullySigned =
  useCaseBuilder("NotifyFranceTravailUserAdvisorOnConventionFullySigned")
    .withInput(withConventionSchema)
    .withDeps<{
      saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
      config: AppConfig;
    }>()
    .build(async ({ inputParams, uow, deps }) => {
      const convention = await uow.conventionRepository.getById(
        inputParams.convention.id,
      );

      if (!convention) return;

      const conventionFtAdvisor =
        convention.signatories.beneficiary.federatedIdentity?.payload?.advisor;

      const [agency] = await uow.agencyRepository.getByIds([
        convention.agencyId,
      ]);

      if (conventionFtAdvisor && agency)
        await deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "POLE_EMPLOI_ADVISOR_ON_CONVENTION_FULLY_SIGNED",
            recipients: [conventionFtAdvisor.email],
            params: {
              advisorFirstName: getFormattedFirstnameAndLastname({
                firstname: conventionFtAdvisor.firstName,
              }),
              advisorLastName: getFormattedFirstnameAndLastname({
                lastname: conventionFtAdvisor.lastName,
              }),
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              beneficiaryEmail: convention.signatories.beneficiary.email,
              businessName: convention.businessName,
              conventionId: convention.id,
              dateEnd: convention.dateEnd,
              dateStart: convention.dateStart,
              immersionAddress: convention.immersionAddress,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                }),
                baseUrl: deps.config.immersionFacileBaseUrl,
              }),
            },
          },
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
          },
        });
    });
