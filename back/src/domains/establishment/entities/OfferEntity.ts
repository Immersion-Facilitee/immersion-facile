import type { ImmersionActivities, RemoteWorkMode, RomeCode } from "shared";

export type OfferEntity = {
  appellationCode: string;
  appellationLabel: string;
  remoteWorkMode: RemoteWorkMode;
  immersionActivities?: ImmersionActivities;
  createdAt: Date;
  romeCode: RomeCode;
  romeLabel: string;
};
