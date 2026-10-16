import type { InternalOfferDto } from "./Offer.dto";

export type SearchImmersionResultPublicV3 = InternalOfferDto;

export const domainToSearchImmersionResultPublicV3 = (
  searchImmersionResult: InternalOfferDto,
): SearchImmersionResultPublicV3 => searchImmersionResult;
