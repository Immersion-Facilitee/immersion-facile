import {
  type Phone,
  type PhoneNumber,
  type PhoneStatus,
  replaceArrayElement,
} from "shared";
import type {
  FixConflictingPhoneParams,
  FixNotConflictingPhoneParams,
  PhoneRepository,
} from "../ports/PhoneRepository";
import type { PhoneId } from "./pgPhoneHelper";

export class InMemoryPhoneRepository implements PhoneRepository {
  phones: Phone[] = [];
  fixConflictingPhoneUpdateCalls: FixConflictingPhoneParams[] = [];
  fixNotConflictingPhoneCalls: FixNotConflictingPhoneParams[] = [];

  async updateStatus(params: {
    phoneIds: PhoneId[];
    status: PhoneStatus;
  }): Promise<void> {
    const { phoneIds, status } = params;

    this.phones = this.phones.map((phone) =>
      phoneIds.includes(phone.id) ? { ...phone, status } : phone,
    );
  }

  async getPhones(params: {
    verifiedBefore?: Date;
    limit?: number;
    verificationStatus?: PhoneStatus[];
    fromId?: number;
  }): Promise<{ phones: Phone[]; cursorId: number | null }> {
    const {
      verifiedBefore = new Date(),
      limit = 100,
      verificationStatus,
      fromId,
    } = params;

    const filtered = this.phones
      .filter((phone) => !phone.verifiedAt || phone.verifiedAt < verifiedBefore)
      .filter((phone) =>
        verificationStatus ? verificationStatus.includes(phone.status) : true,
      )
      .filter((phone) => (fromId ? phone.id > fromId : true));

    const hasMore = filtered.length > limit;
    const phones = filtered.slice(0, limit);

    return {
      phones,
      cursorId: hasMore ? phones[phones.length - 1].id : null,
    };
  }

  async getPhoneById(id: PhoneId): Promise<Phone | undefined> {
    return this.phones.find((phone) => phone.id === id);
  }

  async getPhoneByNumberForTesting(
    phoneNumber: PhoneNumber,
  ): Promise<Phone | undefined> {
    return this.phones.find((phone) => phone.phoneNumber === phoneNumber);
  }

  async markAsVerified(params: {
    phoneIds: PhoneId[];
    verifiedDate: Date;
  }): Promise<void> {
    const phonesVerified = this.phones.map((phone) => {
      const updatedPhone: Phone = params.phoneIds.includes(phone.id)
        ? { ...phone, verifiedAt: params.verifiedDate }
        : phone;
      return updatedPhone;
    });
    this.phones = phonesVerified;
  }

  async getConflictingPhoneNumberId(params: {
    phoneNumber: PhoneNumber;
  }): Promise<number | null> {
    const conflictingPhone = this.phones.find(
      (phone) => phone.phoneNumber === params.phoneNumber,
    );
    return conflictingPhone ? conflictingPhone.id : null;
  }

  async fixConflictingPhone(params: FixConflictingPhoneParams): Promise<void> {
    this.fixConflictingPhoneUpdateCalls.push(params); // Should update all references but not possible in InMemory so we just test that it's correctly invoked
    this.phones = this.phones.filter(
      (phone) => phone.id !== params.phoneToUpdate.id,
    );
  }

  async fixNotConflictingPhone(
    params: FixNotConflictingPhoneParams,
  ): Promise<void> {
    this.fixNotConflictingPhoneCalls.push(params);

    const { phoneToUpdate, newPhoneNumber } = params;

    const phoneToUpdateIndex = this.phones.findIndex(
      (phone) => phone.id === phoneToUpdate.id,
    );

    if (phoneToUpdateIndex === -1) return;

    this.phones = replaceArrayElement(this.phones, phoneToUpdateIndex, {
      ...phoneToUpdate,
      phoneNumber: newPhoneNumber,
      status: "VALID",
    });
  }
}
