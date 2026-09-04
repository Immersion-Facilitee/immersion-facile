import { subMonths } from "date-fns";
import { expectToEqual } from "../test.helpers";
import {
  defaultMonthsThresholdForConventionsListing,
  isConventionArchived,
} from "./convention";

describe("isConventionArchived", () => {
  const now = new Date("2026-09-01T10:10:00.000Z");

  it.each([
    {
      monthsAgo: defaultMonthsThresholdForConventionsListing + 1,
      expected: true,
    },
    {
      monthsAgo: defaultMonthsThresholdForConventionsListing - 1,
      expected: false,
    },
    {
      monthsAgo: defaultMonthsThresholdForConventionsListing,
      expected: false,
    },
  ])("returns $expected when dateEnd is $monthsAgo months ago", ({
    monthsAgo,
    expected,
  }) => {
    const dateEnd = subMonths(now, monthsAgo).toISOString();

    expectToEqual(isConventionArchived({ dateEnd, now }), expected);
  });
});
