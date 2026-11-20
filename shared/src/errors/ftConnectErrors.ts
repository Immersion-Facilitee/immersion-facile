import { expectToEqual } from "../test.helpers";

export type FTConnectErrorKind = (typeof ftConnectErrorKinds)[number];
const ftConnectErrorKinds = [
  "ftConnectInvalidGrant",
  "ftConnectNoAuthorisation",
  "ftConnectAdvisorForbiddenAccess",
  "ftConnectGetUserInfoForbiddenAccess",
  "ftConnectGetUserStatusInfoForbiddenAccess",
  "ftConnectGetUserBirthDateForbiddenAccess",
  "ftConnectGetUserContactDetailsForbiddenAccess",
  "ftConnectConnectionAborted",
] as const;

abstract class RedirectError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}

export class ManagedFTConnectError extends RedirectError {
  constructor(
    public readonly kind: FTConnectErrorKind,
    cause?: Error,
  ) {
    super(
      `A France Travail error of type ${kind} has been thrown.`,
      cause && new Error(cause?.message),
    );
  }
}

export class FTConnectError extends RedirectError {
  constructor(
    public readonly title: string,
    public override readonly message: string,
    cause?: Error,
  ) {
    super(`A raw redirect error has been thrown : ${title} ${message}`, cause);
    this.name = "RawRedirectError";
  }
}

// Use to circumvent the jest/no-conditionnal-expect pattern
export const getTypedError = async <TError>(
  call: () => unknown,
): Promise<TError> => {
  try {
    await call();
    throw new Error();
  } catch (error: unknown) {
    return error as TError;
  }
};

const rawFTConnectErrorFields = ({ name, title, message }: FTConnectError) => ({
  name,
  title,
  message,
});

const managedFTConnectErrorFields = ({
  name,
  kind,
  message,
}: ManagedFTConnectError) => ({ name, kind, message });

export async function testRawFTConnectError(
  cb: () => unknown,
  expectedError: FTConnectError,
) {
  const error: FTConnectError = await getTypedError<FTConnectError>(() => cb());
  expect(error.constructor.name).toEqual(expectedError.constructor.name);
  expectToEqual(
    rawFTConnectErrorFields(error),
    rawFTConnectErrorFields(expectedError),
  );
}

export async function testManagedFTConnectError(
  cb: () => unknown,
  expectedError: ManagedFTConnectError,
) {
  const error: ManagedFTConnectError =
    await getTypedError<ManagedFTConnectError>(() => cb());
  expect(error.constructor.name).toEqual(expectedError.constructor.name);
  expectToEqual(
    managedFTConnectErrorFields(error),
    managedFTConnectErrorFields(expectedError),
  );
}
