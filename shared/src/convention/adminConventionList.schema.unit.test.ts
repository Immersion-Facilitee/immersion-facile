import { expectToEqual } from "../test.helpers";
import { localization } from "../zodUtils";
import type { FlatGetConventionsForAdminParams } from "./adminConventionList.dto";
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

  it("accepts assessment completion status filters", () => {
    const result = flatGetConventionsForAdminParamsSchema.safeParse({
      assessmentCompletionStatus: ["to-complete", "to-sign"],
    });

    expectToEqual(result.data?.assessmentCompletionStatus, [
      "to-complete",
      "to-sign",
    ]);
  });
});
