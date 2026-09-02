import { emailPossiblyEmptySchema, emailSchema } from "./email.schema";

describe("email schemas validation", () => {
  describe("emailSchema validation utils", () => {
    const validEmailsSet = [
      "capitainehaddock@gmail.com",
      "capitaine.haddock@gmail.com",
      "capitaine+haddock@gmail.com",
      "capitaine+haddock@gmail59.com",
      "capitaine.haddock@beta.gouv.fr",
      "capitaine_haddock@beta.go.uv.fr",
      "capitaine.had.dock@beta.gouv.fr",
      "capitaine_haddock_99@beta.gouv.fr",
      "789@haddock.com",
      "bidule.truc@sousdomaine.dom-haine.fr",
      "machin.truc@sous-domaine.domhaine.fr",
    ];

    it.each(validEmailsSet)("email address %s should be valid", (email) => {
      expect(emailSchema.parse(email)).toBe(email);
    });

    const invalidEmailsSet = [
      "beta.gouv.fr",
      "capitainehaddock.",
      "capitainehaddock",
      "capitainehaddock@",
      "capitainehaddock@f",
      "capitainehaddock@gmail",
      "capitaine.haddock@beta_gouv.fr",
      "capitaine.haddock@beta_go__uv.fr",
      "capitaine!!haddock@beta!gouv.fr",
      "capitaine!!haddock@beta!gouv.fr",
      "capitaine!!haddock@betagouvfr",
      "yolo_c-pa_un-mail",
      "cap`pitaine{haddock@gmail.com",
    ];

    it.each(invalidEmailsSet)(
      "email address %s should not be valid",
      (email) => {
        expect(() => emailSchema.parse(email)).toThrow();
      },
    );

    it("email should be normalized", () => {
      expect(emailSchema.parse("MaiL@Email.Com")).toBe("mail@email.com");
    });
  });

  describe("emailPossiblyEmptySchema validation utils", () => {
    it.each(["capitainehaddock@gmail.com", "", undefined])(
      "possibly empty email address '%s' should be valid",
      (email) => {
        expect(emailPossiblyEmptySchema.parse(email)).toBe(email);
      },
    );

    it.each(["not an email :)", "notanEmail", null])(
      "not possibly empty email address '%s' should be invalid",
      (email) => {
        expect(() => emailPossiblyEmptySchema.parse(email)).toThrow();
      },
    );

    it("can check if email is valid without throwing", () => {
      const failureIsSuccess = emailSchema.safeParse("yolo").success;
      const successIsSuccess = emailSchema.safeParse("yolo@mail.com").success;

      expect({
        failureIsSuccess,
        successIsSuccess,
      }).toEqual({
        failureIsSuccess: false,
        successIsSuccess: true,
      });
    });
  });
});
