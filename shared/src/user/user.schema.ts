import z from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import type { AgencyRight, WithAgencyDashboards } from "../agency/agency.dto";
import {
  agencyDtoForAgencyUsersAndAdminsSchema,
  agencyRoleSchema,
} from "../agency/agency.schema";
import { proConnectInfoSchema } from "../auth/proConnect/proConnect.schema";
import { emailSchema } from "../email/email.schema";
import { withBannedEstablishmentInformationSchema } from "../establishment/bannedEstablishmentInformations.schema";
import { businessNameSchema } from "../establishment/businessComponents.schema";
import type {
  UserEstablishmentRightDetails,
  WithEstablishmentDashboards,
} from "../establishment/establishment.dto";
import { establishmentsRoles } from "../role/role.dto";
import { siretSchema } from "../siret/siret.schema";
import { dateTimeIsoStringSchema } from "../utils/date";
import {
  zStringCanBeEmpty,
  zStringCanBeEmptyMax255,
  zStringMinLength1Max255,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import type {
  ConnectedUser,
  Firstname,
  Lastname,
  User,
  UserId,
  UserWithNumberOfAgenciesAndEstablishments,
  WithOptionalUserId,
  WithPreventToDelete,
  WithUserId,
} from "./user.dto";

export const userIdSchema: ZodSchemaWithInputMatchingOutput<UserId> =
  zStringMinLength1Max1024;

export const withUserIdSchema: ZodSchemaWithInputMatchingOutput<WithUserId> =
  z.object({
    userId: userIdSchema,
  });

export const withOptionalUserIdSchema: ZodSchemaWithInputMatchingOutput<WithOptionalUserId> =
  z.object({
    userId: userIdSchema.optional(),
  });

export const withPreventToDeleteSchema: ZodSchemaWithInputMatchingOutput<WithPreventToDelete> =
  z.object({
    preventToDelete: z.boolean(),
  });

const userSchema: ZodSchemaWithInputMatchingOutput<User> = z.object({
  id: userIdSchema,
  email: emailSchema,
  createdAt: dateTimeIsoStringSchema,
  firstName: zStringCanBeEmpty,
  lastName: zStringCanBeEmpty,
  preventToDelete: z.literal(true).optional(),
  proConnect: proConnectInfoSchema.or(z.null()),
});

export const userInListSchema: ZodSchemaWithInputMatchingOutput<UserWithNumberOfAgenciesAndEstablishments> =
  userSchema.and(
    z.object({
      numberOfAgencies: z.number(),
      numberOfEstablishments: z.number(),
    }),
  );

const makePersonNameSchema = ({ mandatory }: { mandatory: boolean }) => {
  if (mandatory) {
    return zStringMinLength1Max255;
  }
  return zStringCanBeEmptyMax255;
};

export const firstnameSchema: ZodSchemaWithInputMatchingOutput<Firstname> =
  makePersonNameSchema({ mandatory: false });
export const firstnameMandatorySchema: ZodSchemaWithInputMatchingOutput<Firstname> =
  makePersonNameSchema({ mandatory: true });

export const lastnameSchema: ZodSchemaWithInputMatchingOutput<Lastname> =
  makePersonNameSchema({ mandatory: false });
export const lastnameMandatorySchema: ZodSchemaWithInputMatchingOutput<Lastname> =
  makePersonNameSchema({ mandatory: true });

const agencyRightSchema: ZodSchemaWithInputMatchingOutput<AgencyRight> =
  z.object({
    agency: agencyDtoForAgencyUsersAndAdminsSchema,
    roles: z.array(agencyRoleSchema),
    isNotifiedByEmail: z.boolean(),
  });

const userEstablishmentRightDetailsCommonShape = {
  siret: siretSchema,
  businessName: businessNameSchema,
  role: z.enum(establishmentsRoles, {
    error: localization.invalidEnum,
  }),
  shouldReceiveDiscussionNotifications: z.boolean(),
};

const userEstablishmentRightDetailsSchema: ZodSchemaWithInputMatchingOutput<UserEstablishmentRightDetails> =
  z
    .discriminatedUnion("status", [
      z.object({
        ...userEstablishmentRightDetailsCommonShape,
        status: z.literal("ACCEPTED"),
        admins: z.array(
          z.object({
            firstName: zStringCanBeEmpty,
            lastName: zStringCanBeEmpty,
            email: emailSchema,
          }),
        ),
      }),
      z.object({
        ...userEstablishmentRightDetailsCommonShape,
        status: z.literal("PENDING"),
      }),
    ])
    .and(withBannedEstablishmentInformationSchema);

const dashboardsSchema: ZodSchemaWithInputMatchingOutput<
  WithAgencyDashboards & WithEstablishmentDashboards
> = z.object({
  establishments: z
    .object({
      conventions: absoluteUrlSchema.nullable(),
      discussions: absoluteUrlSchema.nullable(),
    })
    .strict(),
  agencies: z
    .object({
      agencyDashboardUrl: absoluteUrlSchema.nullable(),
      erroredConventionsDashboardUrl: absoluteUrlSchema.nullable(),
      statsEstablishmentDetailsUrl: absoluteUrlSchema.nullable(),
      agencyManagement: absoluteUrlSchema.nullable(),
      establishmentManagement: absoluteUrlSchema.nullable(),
    })
    .strict(),
});

export const connectedUserSchema: ZodSchemaWithInputMatchingOutput<ConnectedUser> =
  userSchema.and(
    z.object({
      agencyRights: z.array(agencyRightSchema),
      dashboards: dashboardsSchema,
      establishments: z.array(userEstablishmentRightDetailsSchema).optional(),
      isBackofficeAdmin: z.boolean().optional(),
    }),
  );
