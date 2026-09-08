import {
  type FtConnectImmersionAdvisorsKind,
  type ftAdvisorKinds,
  immersionFranceTravailAdvisors,
} from "shared";

export const isFtAdvisorImmersionKind = (
  input: string,
): input is FtConnectImmersionAdvisorsKind =>
  immersionFranceTravailAdvisors.some((value) => value === input);

export type FtConnectAdvisorsKind = (typeof ftAdvisorKinds)[number];

export type FtConnectAdvisorDto = {
  email: string;
  firstName: string;
  lastName: string;
  type: FtConnectAdvisorsKind;
};
