import { useEffect, useRef } from "react";

// WebOTP API: https://developer.mozilla.org/en-US/docs/Web/API/WebOTP_API
// OTPCredential and CredentialRequestOptions.otp are not part of lib.dom typings yet.
type OtpCredential = Credential & { code: string };

type WebOtpCredentialRequestOptions = CredentialRequestOptions & {
  otp: { transport: "sms"[] };
};

const isOtpCredential = (
  credential: Credential | null,
): credential is OtpCredential => credential !== null && "code" in credential;

export const useWebOtpCode = ({
  isEnabled,
  onCode,
}: {
  isEnabled: boolean;
  onCode: (code: string) => void;
}): void => {
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!isEnabled || !("OTPCredential" in window)) return;

    const abortController = new AbortController();
    const options: WebOtpCredentialRequestOptions = {
      otp: { transport: ["sms"] },
      signal: abortController.signal,
    };

    navigator.credentials
      .get(options)
      .then((credential) => {
        if (isOtpCredential(credential)) onCodeRef.current(credential.code);
      })
      .catch(() => {});

    return () => abortController.abort();
  }, [isEnabled]);
};
