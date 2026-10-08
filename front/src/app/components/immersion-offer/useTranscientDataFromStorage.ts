import { useState } from "react";
import type {
  CreateDiscussion1Eleve1StageDto,
  CreateDiscussionDto,
  CreateDiscussionIFDto,
  OmitFromExistingKeys,
} from "shared";

const transcientDataStorageKey = "IfTranscientData";
const preferUseTranscientDataStorageKey = "IfPreferUseTranscientData";

type UnrelevantDataKeyForContactScope =
  | "locationId"
  | "appellationCode"
  | "contactMode"
  | "siret"
  | "kind";

export type ContactTranscientData =
  | OmitFromExistingKeys<
      CreateDiscussionIFDto,
      UnrelevantDataKeyForContactScope
    >
  | OmitFromExistingKeys<
      CreateDiscussion1Eleve1StageDto,
      UnrelevantDataKeyForContactScope
    >;

type TranscientDataItem<T> = {
  value: T | null;
  expireAt: number;
};

export const transcientExpirationTimeInMinutes = 0;

export type TranscientData = {
  "contact-establishment": TranscientDataItem<ContactTranscientData>;
};

type PreferTranscientData = Record<keyof TranscientData, boolean>;

const toContactTranscientData = ({
  locationId: _locationId,
  appellationCode: _appellationCode,
  contactMode: _contactMode,
  siret: _siret,
  kind: _kind,
  ...contactTranscientData
}: CreateDiscussionDto): ContactTranscientData => contactTranscientData;

const isStringTranscientData = (data: object): data is TranscientData =>
  data && typeof data === "object" && "contact-establishment" in data;

export const useTranscientDataFromStorage = (
  scope: keyof TranscientData,
  keepPreferencesInStorage = true,
) => {
  const dataInStorage = localStorage.getItem(transcientDataStorageKey);
  const preferUseTranscientDataInStorage = localStorage.getItem(
    preferUseTranscientDataStorageKey,
  );
  const parsedData = dataInStorage ? JSON.parse(dataInStorage) : null;
  const [transcientData, setTranscientData] = useState<TranscientData | null>(
    isStringTranscientData(parsedData) ? parsedData : null,
  );
  const [preferUseTranscientData, setPreferUseTranscientData] =
    useState<PreferTranscientData>(
      keepPreferencesInStorage && preferUseTranscientDataInStorage
        ? JSON.parse(preferUseTranscientDataInStorage)
        : null,
    );

  const setPreferUseTranscientDataForScope = (preferUse: boolean) => {
    const updatedData = {
      ...preferUseTranscientData,
      [scope]: preferUse,
    };
    setPreferUseTranscientData(updatedData);
    if (keepPreferencesInStorage) {
      localStorage.setItem(
        preferUseTranscientDataStorageKey,
        JSON.stringify(updatedData),
      );
    }
  };

  const getExpireAt = (expireInMinutes: number) => {
    if (expireInMinutes) {
      return Date.now() + expireInMinutes * 60 * 1000;
    }
    if (transcientData?.["contact-establishment"]) {
      return transcientData["contact-establishment"].expireAt;
    }
    return 0;
  };

  const setTranscientDataForScope = (
    data: CreateDiscussionDto,
    expireInMinutes = 0,
  ) => {
    const updatedDataItem: TranscientDataItem<ContactTranscientData> = {
      expireAt: getExpireAt(expireInMinutes),
      value: toContactTranscientData(data),
    };
    const updatedData = {
      ...transcientData,
      [scope]: updatedDataItem,
    };
    setTranscientData(updatedData);
    localStorage.setItem(transcientDataStorageKey, JSON.stringify(updatedData));
  };

  const clearTranscientDataForScope = () => {
    setTranscientData(null);
    localStorage.removeItem(transcientDataStorageKey);
  };

  const getTranscientDataForScope =
    (): TranscientDataItem<ContactTranscientData> | null => {
      const data = transcientData?.[scope] ?? null;
      const shouldDataExpire = data?.expireAt && data.expireAt < Date.now();
      if (shouldDataExpire) {
        localStorage.removeItem(transcientDataStorageKey);
        if (keepPreferencesInStorage) {
          localStorage.removeItem(preferUseTranscientDataStorageKey);
        }
        return {
          expireAt: 0,
          value: null,
        };
      }
      return data;
    };
  const getPreferUseTranscientDataForScope = (): boolean | null =>
    preferUseTranscientData?.[scope] ?? null;
  return {
    getPreferUseTranscientDataForScope,
    setPreferUseTranscientDataForScope,
    transcientData,
    setTranscientData,
    getTranscientDataForScope,
    setTranscientDataForScope,
    clearTranscientDataForScope,
  };
};
