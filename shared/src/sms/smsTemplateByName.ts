import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { PhoneNumber } from "../phone/phone.dto";
import type { KeysOfUnion, ValueOf } from "../utils";

type GenericTemplatedSms<
  T extends string,
  P extends Record<string, unknown>,
> = {
  kind: T;
  params: P;
  recipientPhone: PhoneNumber;
};

type WithShortLink = { shortLink: AbsoluteUrl };

type SmsParamsBySmsType = {
  ReminderForSignatories: WithShortLink;
  ReminderForAssessment: WithShortLink;
  ReminderForAssessmentSignature: WithShortLink;
  HelloWorld: {
    testMessage: string;
  };
};

export type TemplatedSms = ValueOf<{
  [K in keyof SmsTemplateByName]: GenericTemplatedSms<K, SmsParamsBySmsType[K]>;
}>;

export type SmsVariables = KeysOfUnion<TemplatedSms["params"]>;

const createSmsTemplates = (
  templatesByName: {
    [K in keyof SmsParamsBySmsType]: {
      createContent: (params: SmsParamsBySmsType[K]) => string;
    };
  },
) => templatesByName;

export type SmsTemplateByName = typeof smsTemplatesByName;
export type SmsTemplateKind = keyof SmsParamsBySmsType;
export const smsTemplatesByName = createSmsTemplates({
  ReminderForSignatories: {
    createContent: ({ shortLink }) =>
      `Bonjour,\n\nSignez votre convention avec ce lien :\n${shortLink}\n\nImmersion Facilitée`,
  },
  ReminderForAssessment: {
    createContent: ({ shortLink }) =>
      `Bonjour,\n\nComplétez le bilan avec ce lien :\n${shortLink}\n\nImmersion Facilitée`,
  },
  ReminderForAssessmentSignature: {
    createContent: ({ shortLink }) =>
      `Bonjour,\n\nSignez votre bilan avec ce lien :\n${shortLink}\n\nImmersion Facilitée`,
  },
  HelloWorld: {
    createContent: ({ testMessage }) =>
      `Immersion Facilitée - Test SMS - ${testMessage}`,
  },
});
