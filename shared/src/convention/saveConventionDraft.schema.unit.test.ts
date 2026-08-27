import z from "zod";
import { expectToEqual } from "../test.helpers";
import type {
  ConventionDraftDto,
  SaveConventionDraftFromConventionDto,
  SaveConventionDraftFromConventionTemplateDto,
} from "./saveConventionDraft.dto";
import {
  conventionDraftSchema,
  makeConventionDeepPartialSchema,
  saveConventionDraftFromConventionSchema,
  saveConventionDraftFromConventionTemplateSchema,
  saveConventionDraftSchema,
} from "./saveConventionDraft.schema";

describe("saveConventionDraftSchema schema validation", () => {
  it("can have no senderEmail nor recipientEmail", () => {
    const safeParse = saveConventionDraftSchema.safeParse({
      mode: "duplicate",
      conventionDraft: {
        id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
        internshipKind: "immersion",
      },
    });
    expectToEqual(safeParse.error, undefined);
    expectToEqual(safeParse.success, true);
  });
});

describe("saveConventionDraftFromConventionSchema schema validation", () => {
  it.each<SaveConventionDraftFromConventionDto>([
    {
      mode: "duplicate",
      senderEmail: "test@test.com",
      conventionDraft: {
        id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
        internshipKind: "immersion",
      },
    },
    {
      mode: "duplicate",
      senderEmail: "sender@example.com",
      recipientEmail: "recipient@example.com",
      details: "Some details",
      conventionDraft: {
        id: "bbbbbc99-9c0b-1aaa-aa6d-6bb9bd38bbbb",
        internshipKind: "mini-stage-cci",
      },
    },
  ])("accepts valid data", (data) => {
    expectToEqual(saveConventionDraftFromConventionSchema.parse(data), data);
  });

  it.each([
    {
      senderEmail: "not-an-email",
    } as SaveConventionDraftFromConventionDto,
    {
      senderEmail: "not-an-email",
      conventionDraft: {
        id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
        internshipKind: "immersion",
      },
    },
    {
      recipientEmail: "test@email.com",
      conventionDraft: {
        id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
        internshipKind: "immersion",
      },
    } as SaveConventionDraftFromConventionDto,
  ])("fails on invalid data", (data) => {
    expect(() => saveConventionDraftFromConventionSchema.parse(data)).toThrow();
  });
});

describe("saveConventionDraftFromConventionTemplateSchema schema validation", () => {
  it.each<SaveConventionDraftFromConventionTemplateDto>([
    {
      mode: "duplicate",
      recipientEmail: "test@test.com",
      conventionDraft: {
        id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
        internshipKind: "immersion",
      },
    },
    {
      mode: "duplicate",
      recipientEmail: "test@example.com",
      details: "Some details",
      conventionDraft: {
        id: "bbbbbc99-9c0b-1aaa-aa6d-6bb9bd38bbbb",
        internshipKind: "mini-stage-cci",
      },
    },
  ])("accepts valid data", (data) => {
    expectToEqual(
      saveConventionDraftFromConventionTemplateSchema.parse(data),
      data,
    );
  });

  it.each([
    {
      recipientEmail: "not-an-email",
    } as SaveConventionDraftFromConventionTemplateDto,
    {
      recipientEmail: "not-an-email",
      conventionDraft: {
        id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
        internshipKind: "immersion",
      },
    },
  ])("fails on invalid data", (data) => {
    expect(() =>
      saveConventionDraftFromConventionTemplateSchema.parse(data),
    ).toThrow();
  });
});

describe("conventionDraftSchema schema validation", () => {
  it.each([
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      immersionAddress: "17 rue de la paix, 75000 Paris",
      internshipKind: "immersion",
    } satisfies ConventionDraftDto,
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "immersion",
      signatories: {
        beneficiary: {
          email: "beneficiary@test.com",
        },
      },
    } satisfies ConventionDraftDto,
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "immersion",
      signatories: {
        establishmentRepresentative: {
          phone: undefined,
        },
      },
    } satisfies ConventionDraftDto,
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "mini-stage-cci",
      signatories: {
        beneficiary: {
          address: {
            streetNumberAndAddress: "17 rue de la paix, 75000 Paris",
            postcode: "75000",
            departmentCode: "75",
            city: "Paris",
          },
        },
      },
    } satisfies ConventionDraftDto,
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "mini-stage-cci",
      signatories: {
        beneficiary: {
          schoolName: "Lycée Victor Hugo",
        },
      },
    } satisfies ConventionDraftDto,
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "mini-stage-cci",
      signatories: {
        beneficiary: {
          schoolPostcode: "75000",
        },
      },
    } satisfies ConventionDraftDto,
  ])("makes the schema partial", (convention: ConventionDraftDto) => {
    expect(() => conventionDraftSchema.parse(convention)).not.toThrow();
  });

  it.each([
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "immersion",
      signatories: {
        beneficiary: {
          levelOfEducation: "1ère",
        },
      },
    } satisfies ConventionDraftDto,
    {
      id: "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa",
      internshipKind: "immersion",
      signatories: {
        beneficiary: {
          address: {
            streetNumberAndAddress: "17 rue de la paix, 75000 Paris",
            postcode: "75000",
            departmentCode: "75",
            city: "Paris",
          },
        },
      },
    } satisfies ConventionDraftDto,
  ])("throws on invalid data", (convention: ConventionDraftDto) => {
    expect(() => conventionDraftSchema.parse(convention)).toThrow();
  });
});

describe("makeConventionDeepPartialSchema", () => {
  it("makes the object deeply partial", () => {
    const withPersonSchema = z.object({
      person: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const canHaveOptionalRootKey = makeConventionDeepPartialSchema(
      withPersonSchema,
    ).safeParse({});

    expect(canHaveOptionalRootKey.success).toBeTruthy();

    const canHaveOptionalDeepKey = makeConventionDeepPartialSchema(
      withPersonSchema,
    ).safeParse({
      person: {
        age: 30,
      },
    });

    expect(canHaveOptionalDeepKey.success).toBeTruthy();
  });

  it("makes the array deeply partial", () => {
    const withPeopleSchema = z.object({
      person: z.object({
        books: z.array(z.string()),
      }),
    });

    const canHaveOptionalArray = makeConventionDeepPartialSchema(
      withPeopleSchema,
    ).safeParse({
      person: {},
    });

    expect(canHaveOptionalArray.success).toBeTruthy();

    const canHaveEmptyArray = makeConventionDeepPartialSchema(
      withPeopleSchema,
    ).safeParse({
      person: {
        books: [],
      },
    });

    expect(canHaveEmptyArray.success).toBeTruthy();
  });

  it("makes deep partial work with union", () => {
    const unionSchema = makeConventionDeepPartialSchema(
      z.object({
        person: z.object({
          name: z.string(),
        }),
      }),
    ).or(
      z.object({
        otherInfo: z.string(),
      }),
    );

    const result = unionSchema.safeParse({
      person: {},
    });

    expect(result.success).toBeTruthy();
  });

  it("makes deep partial work with intersection", () => {
    const intersectionSchema = makeConventionDeepPartialSchema(
      z.object({
        person: z.object({
          name: z.string(),
        }),
      }),
    ).and(
      z.object({
        otherInfo: z.string(),
      }),
    );

    const result = intersectionSchema.safeParse({
      otherInfo: "Other info",
    });

    expect(result.success).toBeTruthy();
  });
});
