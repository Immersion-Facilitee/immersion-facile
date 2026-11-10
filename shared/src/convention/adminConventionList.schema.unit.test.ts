import { expectToEqual } from "../test.helpers";
import { localization } from "../zodUtils";
import type {
  AdminConventionListSortBy,
  FlatGetConventionsForAdminParams,
} from "./adminConventionList.dto";
import { flatGetConventionsForAdminParamsSchema } from "./adminConventionList.schema";

const textFilterNames: (keyof Pick<
  FlatGetConventionsForAdminParams,
  "search" | "agencyNameContains"
>)[] = ["search", "agencyNameContains"];

describe("flatGetConventionsForAdminParamsSchema", () => {
  it.each(textFilterNames)(
    "accepts %s with at least 3 characters after trim",
    (filterName) => {
      const result = flatGetConventionsForAdminParamsSchema.safeParse({
        [filterName]: "  dup  ",
      });

      expectToEqual(result.success, true);
      expectToEqual(result.data?.[filterName], "dup");
    },
  );

  it.each(textFilterNames)(
    "rejects %s with less than 3 characters after trim",
    (filterName) => {
      const result = flatGetConventionsForAdminParamsSchema.safeParse({
        [filterName]: " du ",
      });

      expectToEqual(result.success, false);
      expectToEqual(
        result.error?.issues.map(({ message }) => message),
        [localization.minCharacters(3)],
      );
    },
  );
});

const adminSortByValues: AdminConventionListSortBy[] = [
  "dateSubmission",
  "dateStart",
];

describe("flatGetConventionsForAdminParamsSchema sort and agency filter", () => {
  it.each(adminSortByValues)("accepts sortBy %s", (sortBy) => {
    const result = flatGetConventionsForAdminParamsSchema.safeParse({
      sortBy,
    });

    expectToEqual(result.data?.sortBy, sortBy);
  });

  it("rejects sortBy not available for admin", () => {
    const result = flatGetConventionsForAdminParamsSchema.safeParse({
      sortBy: "dateEnd",
    });

    expectToEqual(result.success, false);
  });

  it("accepts agencyIds", () => {
    const agencyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const result = flatGetConventionsForAdminParamsSchema.safeParse({
      agencyIds: [agencyId],
    });

    expectToEqual(result.data?.agencyIds, [agencyId]);
  });

  it("rejects empty agencyIds", () => {
    const result = flatGetConventionsForAdminParamsSchema.safeParse({
      agencyIds: [],
    });

    expectToEqual(result.success, false);
  });
});
