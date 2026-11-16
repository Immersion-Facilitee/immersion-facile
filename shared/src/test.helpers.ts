import { uniq } from "ramda";
import type { HttpResponse, UnknownSharedRoute } from "shared-routes";
import type { EmailType, TemplatedEmail } from "./email/email";
import type { Email } from "./email/email.dto";
import { BadRequestError } from "./errors/httpErrors";
import type { TemplatedSms } from "./sms/smsTemplateByName";

export const expectPromiseToFail = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toThrow();
};

export const expectPromiseToFailWithError = async <T extends Error>(
  promise: Promise<unknown>,
  expectedError: T,
) => {
  await expect(promise).rejects.toThrow(expectedError);
  await expect(promise).rejects.toBeInstanceOf(expectedError.constructor);
  if (expectedError instanceof BadRequestError) {
    await expectPromiseToFailWithBadRequestError(promise, expectedError);
  }
};

const expectPromiseToFailWithBadRequestError = async (
  promise: Promise<unknown>,
  expectedError: BadRequestError,
) => {
  try {
    await promise;
    expect("not reach").toBe("Promise resolve, expected to reject");
  } catch (e: any) {
    expect(e instanceof BadRequestError).toBe(true);
    if (!(e instanceof BadRequestError)) throw new Error("Not a bad request");
    expect(e.message).toBe(expectedError.message);
    expect(e.issues).toEqual(expectedError.issues);
  }
};

export const expectArraysToMatch = <T>(actual: T[], expected: Partial<T>[]) => {
  expect(actual).toMatchObject(expected);
};

export const expectArraysToEqual = <T>(actual: T[], expected: T[]) => {
  expect(actual).toEqual(expected);
};

export const expectJwtInMagicLinkAndGetIt = (link: string | unknown) => {
  expect(typeof link).toBe("string");
  const jwt = new URL(link as string).searchParams.get("jwt");
  expect(jwt).toBeTruthy();
  return jwt as string;
};

export const expectArraysToEqualIgnoringOrder = <T>(
  actual: T[],
  expected: T[],
) => {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
};

export const splitCasesBetweenPassingAndFailing = <
  A extends string,
  P extends A,
>(
  allValues: readonly A[],
  passingValues: readonly P[],
): [P[], Exclude<A, P>[]] => {
  const passingSet = new Set(passingValues);
  const passingCases: P[] = [];
  const failingCases: Exclude<A, P>[] = [];

  for (const value of allValues)
    passingSet.has(value as P)
      ? passingCases.push(value as P)
      : failingCases.push(value as Exclude<A, P>);

  return [uniq(passingCases), uniq(failingCases)];
};

export const expectEmailOfType = <
  T extends EmailType,
  E extends TemplatedEmail = TemplatedEmail,
>(
  email: E,
  expectedEmailType: T,
): Extract<E, { kind: T }> => {
  expect(email.kind).toBe(expectedEmailType);
  return email as Extract<E, { kind: T }>;
};

export const expectSmsOfType = <
  T extends TemplatedSms["kind"],
  E extends TemplatedSms = TemplatedSms,
>(
  sms: E,
  expectedSmsType: T,
): Extract<E, { kind: T }> => {
  expect(sms.kind).toBe(expectedSmsType);
  return sms as Extract<E, { kind: T }>;
};

export const expectToEqual = <T>(actual: T, expected: T) => {
  expect(actual).toEqual(expected);
};

export const expectHttpResponseToEqual = <
  R extends HttpResponse<string | number | symbol, unknown>,
>(
  { headers, ...rest }: R,
  expected: Omit<R, "headers"> & Partial<Pick<R, "headers">>,
) => {
  const { headers: expectedHeaders, ...expectedRest } = expected;
  expect(rest).toEqual<typeof expectedRest>(expectedRest);
  expect(headers).toMatchObject(expectedHeaders ?? {});
};

export const expectObjectsToMatch = <T>(actual: T, expected: Partial<T>) => {
  expect(actual).toMatchObject(expected);
};

export const expectObjectInArrayToMatch = <T>(
  actual: T[],
  expected: Partial<T>[],
) => {
  expect(actual).toMatchObject(expected);
};

export const displayRouteName = (route: UnknownSharedRoute): string =>
  `${route.method.toUpperCase()} ${route.url} -`;

export const adminPlaywrightEmail: Email =
  "admin+playwright@immersion-facile.beta.gouv.fr";
