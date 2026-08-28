import axios from "axios";
import {
  addressRoutes,
  adminRoutes,
  agencyRoutes,
  authenticatedConventionRoutes,
  authRoutes,
  conventionMagicLinkRoutes,
  establishmentLeadRoutes,
  establishmentRoutes,
  formCompletionRoutes,
  nafRoutes,
  searchImmersionRoutes,
  technicalRoutes,
  unauthenticatedConventionRoutes,
} from "shared";
import type { UnknownSharedRoute } from "shared-routes";
import { createAxiosSharedClient } from "shared-routes/axios";
import { createCommonDependencies } from "src/config/createCommonDependencies";
import type { Dependencies } from "src/config/dependencies";
import { HttpAddressGateway } from "src/core-logic/adapters/AddressGateway/HttpAddressGateway";
import { HttpAdminGateway } from "src/core-logic/adapters/AdminGateway/HttpAdminGateway";
import { HttpAgencyGateway } from "src/core-logic/adapters/AgencyGateway/HttpAgencyGateway";
import { HttpAssessmentGateway } from "src/core-logic/adapters/AssessmentGateway/HttpAssessmentGateway";
import { HttpAuthGateway } from "src/core-logic/adapters/AuthGateway/HttpAuthGateway";
import { HttpConventionGateway } from "src/core-logic/adapters/Convention/HttpConventionGateway";
import { HttpEstablishmentGateway } from "src/core-logic/adapters/EstablishmentGateway/HttpEstablishmentGateway";
import { HttpEstablishmentLeadGateway } from "src/core-logic/adapters/EstablishmentLeadGateway/HttpEstablishmentLeadGateway";
import { HttpFormCompletionGateway } from "src/core-logic/adapters/FormCompletionGateway/HttpFormCompletionGateway";
import { DecodeJwtValidator } from "src/core-logic/adapters/JwtValidator/DecodeJwtValidator";
import { HttpNafGateway } from "src/core-logic/adapters/NafGateway/HttpNafGateway";
import { HttpSearchGateway } from "src/core-logic/adapters/SearchGateway/HttpSearchGateway";
import { HttpTechnicalGateway } from "src/core-logic/adapters/TechnicalGateway/HttpTechnicalGateway";

const withBaseUrlConfig = { baseURL: "/api" };
const axiosOnSlashApi = axios.create({
  ...withBaseUrlConfig,
  validateStatus: () => true,
});

const createAxiosHttpClientOnSlashApi = <
  SharedRoutes extends Record<string, UnknownSharedRoute>,
>(
  routes: SharedRoutes,
) =>
  createAxiosSharedClient(routes, axiosOnSlashApi, {
    skipResponseValidationForStatuses: [500],
  });

export const createHttpDependencies = (): Dependencies => {
  return {
    ...createCommonDependencies(),
    addressGateway: new HttpAddressGateway(
      createAxiosHttpClientOnSlashApi(addressRoutes),
    ),
    adminGateway: new HttpAdminGateway(
      createAxiosHttpClientOnSlashApi(adminRoutes),
    ),
    authGateway: new HttpAuthGateway(
      createAxiosHttpClientOnSlashApi(authRoutes),
    ),
    agencyGateway: new HttpAgencyGateway(
      createAxiosHttpClientOnSlashApi(agencyRoutes),
    ),
    assessmentGateway: new HttpAssessmentGateway(
      createAxiosHttpClientOnSlashApi(conventionMagicLinkRoutes),
    ),
    conventionGateway: new HttpConventionGateway(
      createAxiosHttpClientOnSlashApi(conventionMagicLinkRoutes),
      createAxiosHttpClientOnSlashApi(unauthenticatedConventionRoutes),
      createAxiosHttpClientOnSlashApi(authenticatedConventionRoutes),
    ),
    establishmentGateway: new HttpEstablishmentGateway(
      createAxiosHttpClientOnSlashApi(establishmentRoutes),
    ),
    establishmentLeadGateway: new HttpEstablishmentLeadGateway(
      createAxiosHttpClientOnSlashApi(establishmentLeadRoutes),
    ),
    formCompletionGateway: new HttpFormCompletionGateway(
      createAxiosHttpClientOnSlashApi(formCompletionRoutes),
    ),
    searchGateway: new HttpSearchGateway(
      createAxiosHttpClientOnSlashApi(searchImmersionRoutes),
    ),
    technicalGateway: new HttpTechnicalGateway(
      createAxiosHttpClientOnSlashApi(technicalRoutes),
      axiosOnSlashApi,
    ),
    nafGateway: new HttpNafGateway(createAxiosHttpClientOnSlashApi(nafRoutes)),
    jwtValidator: new DecodeJwtValidator(),
  };
};
