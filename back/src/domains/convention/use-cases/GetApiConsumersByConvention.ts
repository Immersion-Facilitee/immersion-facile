import {
  type AgencyId,
  type AgencyKind,
  type ApiConsumerName,
  type ConnectedUser,
  errors,
  userHasEnoughRightsOnConvention,
  type WithConventionId,
  withConventionIdSchema,
} from "shared";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type GetApiConsumersByConvention = ReturnType<
  typeof makeGetApiConsumersByConvention
>;
export const makeGetApiConsumersByConvention = useCaseBuilder(
  "GetApiConsumersByConvention",
)
  .withInput<WithConventionId>(withConventionIdSchema)
  .withOutput<ApiConsumerName[]>()
  .withCurrentUser<ConnectedUser>()

  .build(async ({ uow, currentUser, inputParams: { conventionId } }) => {
    const convention = await uow.conventionRepository.getById(conventionId);

    if (!convention)
      throw errors.convention.notFound({
        conventionId,
      });

    const user = await getUserWithRights(uow, currentUser.id);

    if (!user)
      throw errors.user.notFound({
        userId: currentUser.id,
      });

    const agency = await uow.agencyRepository.getById(convention.agencyId);

    if (!agency)
      throw errors.agency.notFound({
        agencyId: convention.agencyId,
      });

    if (
      !userHasEnoughRightsOnConvention(user, convention, [
        "counsellor",
        "validator",
        "agency-viewer",
      ])
    )
      throw errors.user.forbidden({
        userId: currentUser.id,
      });

    const agencyRefersTo = agency.refersToAgencyId
      ? await uow.agencyRepository.getById(agency.refersToAgencyId)
      : undefined;

    const agencyIds: AgencyId[] = agencyRefersTo
      ? [agency.id, agencyRefersTo.id]
      : [agency.id];
    const agencyKinds: AgencyKind[] = agencyRefersTo
      ? [agency.kind, agencyRefersTo.kind]
      : [agency.kind];

    const conventionApiConsurmers = (
      await uow.apiConsumerRepository.getByFilters({
        agencyIds,
        agencyKinds,
      })
    ).filter(
      (apiConsumer) => apiConsumer.rights.convention.subscriptions.length !== 0,
    );

    const agencyKindsAllowedToBroadcastToFT: AgencyKind[] = [
      "france-travail",
      "cap-emploi",
      "conseil-departemental",
    ];
    return [
      ...conventionApiConsurmers.map(({ name }) => name),
      ...(agencyKindsAllowedToBroadcastToFT.includes(agency.kind) ||
      (agencyRefersTo &&
        agencyKindsAllowedToBroadcastToFT.includes(agencyRefersTo.kind))
        ? ["France Travail"]
        : []),
    ];
  });
