import type { SupportedCountryCode } from "../address/address.dto";
import {
  isValidMobilePhone,
  phoneNumberSchema,
  toInternationalPhoneNumber,
} from "./phone.schema";

describe("phonesShema", () => {
  it.each<string>([
    "+33600000000", //FR default number
    "+33600000001", //FR default number
    "+33100000000", //FR
    "+33555689727", //FR
    "+262269612345", //YT
    "+590590275843", //GP
    "+594594912345", //GF
    "+596596812345", //MQ
    "+262262612345", //RE
    //"+68940123456", //PF - seems to be invalid for libphonenumber-js/max
    "+687245678", //NC
    "+681723456", //WF
    "+508412356", //PM
    "+37257702405", // ESTONIA
    "+49254879865", // GERMANY
    "+34912345678", // ES
    "+4532123456", // DK
    "+35312345678", // IR
  ])(
    "should be valid for fix phone number (FR and other countries) %s",
    async (phone) => {
      expect(phoneNumberSchema.parse(phone)).toBe(phone);
    },
  );

  it.each<string>([
    "+33600000000", //FR
    "+33785689727", //FR
    "+262639000001", //YT
    "+590690000001", //GP
    "+590691282545", //GP
    "+594694000001", //GF
    "+596696000001", //MQ
    "+262692000001", //RE
    "+262693000001", //RE
    "+68987123456", //PF
    "+687751234", //NC
    "+681723456", //WF
    "+508551234", //PM
    "+491701234567", // DE
    "+34612345678", // ES
    "+4521123456", // DK
    "+351912345678", // IR
  ])(
    "should be valid for mobile phone number (FR and other countries) %s",
    async (phone) => {
      expect(phoneNumberSchema.parse(phone)).toBe(phone);
    },
  );

  it.each<string>([
    "+33785689727",
    "+262639000001",
    "+590690000001",
    "+590691282545",
    "+594694000001",
    "+596696000001",
    "+262692000001",
    "+262693000001",
    "+68987770076",
    "+687751234",
    "+681821234",
    "+508551234",
    "+491701234567", // DE
    "+34612345678", // ES
    "+4521123456", // DK
    "+351912345678", // IR
  ])(
    "should be a valid mobile phone number (FR and other countries) %s",
    async (phone) => {
      expect(isValidMobilePhone(phone)).toBe(true);
    },
  );

  it.each<string>(["+33600000000", "+33600000001"])(
    "default placeholder phones must not count as valid mobile for SMS eligibility %s",
    (phone) => {
      expect(isValidMobilePhone(phone)).toBe(false);
    },
  );

  it.each<string>([
    "+41000123456", // CH
    "+390012345678", // IT
    "+3221234567", // BE
    "+34598765432", // ES
  ])(
    "invalid phone number (due to local number assignation) should not be considered as a valid phone number %s",
    async (phone) => {
      expect(() => phoneNumberSchema.parse(phone)).toThrow();
    },
  );
});

describe("toInternationalPhoneNumber", () => {
  it.each<[string, SupportedCountryCode, string]>([
    ["0693011313", "FR", "+262693011313"], // RE
    ["0697011313", "FR", "+596697011313"], // MQ
    ["0628862346", "DE", "+49628862346"], // DE
    ["0628862346", "FR", "+33628862346"], // FR
    ["0549901591", "FR", "+33549901591"], // FR
    ["912345678", "ES", "+34912345678"], // ES
    ["071234567", "BE", "+3271234567"], // BE
    ["0441234567", "CH", "+41441234567"], // CH
    ["0612345678", "IT", "+390612345678"], // IT
    ["0986185807", "FR", "+33986185807"], // FR
    ["0699160058", "FR", "+33699160058"], // FR
    ["0696190095", "FR", "+596696190095"], // MQ
  ])(
    "should assign the right prefix to the phone number %s",
    async (phone, countryCode, expected) => {
      const result = toInternationalPhoneNumber(phone, countryCode);
      expect(result).toBe(expected);
    },
  );
});
