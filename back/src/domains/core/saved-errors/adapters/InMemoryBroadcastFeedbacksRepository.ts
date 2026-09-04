import { type BroadcastFeedback, type ConventionId, errors } from "shared";

import type { BroadcastFeedbacksRepository } from "../ports/BroadcastFeedbacksRepository";

export class InMemoryBroadcastFeedbacksRepository
  implements BroadcastFeedbacksRepository
{
  // for testing purposes
  #broadcastFeedbacks: BroadcastFeedback[] = [];

  public async markPartnersErroredConventionAsHandled(
    conventionId: ConventionId,
  ): Promise<void> {
    const hasConventionErrorToMarkAsHandled = this.#broadcastFeedbacks.some(
      (broadcastFeedback) =>
        isBroadcastFeedbackUnhandledErrorForConvention(
          broadcastFeedback,
          conventionId,
        ),
    );

    if (!hasConventionErrorToMarkAsHandled)
      throw errors.broadcastFeedback.notFound({
        conventionId,
      });

    this.#broadcastFeedbacks = this.#broadcastFeedbacks.map(
      (broadcastFeedback) => {
        if (
          isBroadcastFeedbackUnhandledErrorForConvention(
            broadcastFeedback,
            conventionId,
          )
        ) {
          return { ...broadcastFeedback, handledByAgency: true };
        }
        return broadcastFeedback;
      },
    );
  }

  public async save(broadcastFeedback: BroadcastFeedback): Promise<void> {
    if (
      broadcastFeedback.conventionId !==
      broadcastFeedback.requestParams.conventionId
    )
      throw new Error("Broadcast feedback convention ids must match");

    this.#broadcastFeedbacks.push(broadcastFeedback);
  }

  public async getLastBroadcastFeedback(
    conventionId: ConventionId,
  ): Promise<BroadcastFeedback | null> {
    return (
      this.#broadcastFeedbacks
        .filter(
          (broadcast) => broadcast.requestParams.conventionId === conventionId,
        )
        .sort(
          (a, b) =>
            new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
        )
        .at(-1) || null
    );
  }

  public async getBroadcastFeedbacksByConventionId(
    conventionId: ConventionId,
  ): Promise<BroadcastFeedback[]> {
    return this.#broadcastFeedbacks
      .filter((broadcast) => broadcast.conventionId === conventionId)
      .sort(
        (a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );
  }

  public get broadcastFeedbacks(): BroadcastFeedback[] {
    return this.#broadcastFeedbacks;
  }

  public set broadcastFeedbacks(broadcastFeedbacks: BroadcastFeedback[]) {
    this.#broadcastFeedbacks = broadcastFeedbacks;
  }
}

const isBroadcastFeedbackUnhandledErrorForConvention = (
  broadcastFeedback: BroadcastFeedback,
  conventionId: ConventionId,
) =>
  broadcastFeedback.requestParams &&
  "conventionId" in broadcastFeedback.requestParams &&
  broadcastFeedback.requestParams.conventionId === conventionId &&
  broadcastFeedback.handledByAgency === false;
