import { fr } from "@codegouvfr/react-dsfr";
import { Tag as ImTag, SearchResultIllustration } from "react-design-system";
import {
  addressStringToDto,
  type FormEstablishmentDto,
  type OfferDto,
} from "shared";
import { searchIllustrations } from "src/assets/img/illustrations";
import { useStyles } from "tss-react/dsfr";
import { SearchResult } from "../../search/SearchResult";

const establishmentToSearchResultPreview = ({
  offers,
  naf,
  businessNameCustomized,
  businessName,
  businessAddresses,
  siret,
  website,
  fitForDisabledWorkers,
  additionalInformation,
}: FormEstablishmentDto): OfferDto => ({
  establishmentScore: 0,
  rome: offers.length > 0 ? offers[0].romeCode : "",
  romeLabel: offers.length > 0 ? offers[0].romeLabel : "",
  appellations: offers.map((offer) => ({
    appellationCode: offer.appellationCode,
    appellationLabel: offer.appellationLabel,
  })),
  nafLabel: "",
  naf: naf?.code || "",
  name: businessName,
  customizedName: businessNameCustomized,
  // Fake data
  voluntaryToImmersion: true,
  position: {
    lat: 0,
    lon: 0,
  },
  address: addressStringToDto(businessAddresses[0]?.rawAddress),
  siret,
  website,
  fitForDisabledWorkers,
  additionalInformation,
  locationId: "",
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  remoteWorkMode: offers.length > 0 ? offers[0].remoteWorkMode : "HYBRID",
  isAvailable: true,
});

type SearchResultPreviewProps = {
  establishment: FormEstablishmentDto;
};

export const SearchResultPreview = ({
  establishment,
}: SearchResultPreviewProps) => {
  const { cx } = useStyles();
  return (
    <section className={cx("im-establishment-preview")}>
      <div
        className={cx(
          fr.cx("fr-grid-row", "fr-mb-4w"),
          "im-establishment-preview__inner",
        )}
      >
        <div className={fr.cx("fr-col-12", "fr-col-lg-4")}>
          <SearchResult
            mode="list"
            illustration={
              <SearchResultIllustration illustration={searchIllustrations[0]}>
                <div className={fr.cx("fr-p-1v")}>
                  {establishment.fitForDisabledWorkers && (
                    <ImTag theme="rqth" />
                  )}
                  <ImTag theme="voluntaryToImmersion" />
                </div>
              </SearchResultIllustration>
            }
            linkProps={{
              href: "#",
              onClick: () => {},
            }}
            searchResult={establishmentToSearchResultPreview(establishment)}
            preview
          />
        </div>
      </div>
    </section>
  );
};
