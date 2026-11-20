import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import type { AddressDto } from "shared";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultAddress.scss";

type SearchResultAddressProps = {
  address: AddressDto;
};

export const SearchResultAddress = ({
  address,
}: SearchResultAddressProps): ReactNode => {
  const { cx } = useStyles();
  return (
    <>
      <span
        className={cx(
          "im-search-result-address__icon",
          fr.cx("fr-icon-map-pin-2-line", "fr-icon--sm", "fr-mr-1w"),
        )}
        aria-hidden="true"
      />
      {address.streetNumberAndAddress}, {address.postcode} {address.city}
    </>
  );
};
