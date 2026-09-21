import type {
  DeviceRepository,
  GenericStorage,
} from "src/core-logic/ports/DeviceRepository";

export const createTestDeviceRepository = <
  S extends GenericStorage,
>(): DeviceRepository<S> => {
  const fakeStorage: Partial<Record<string, any>> = {};

  return {
    delete(key): void {
      delete fakeStorage[key];
    },
    get: (key) => fakeStorage[key],
    set: ((key: string, value: any) => {
      fakeStorage[key] = value;
    }) as any,
  };
};
