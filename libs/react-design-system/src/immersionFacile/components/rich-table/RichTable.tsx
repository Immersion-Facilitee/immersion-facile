import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import {
  Pagination,
  type PaginationProps,
} from "@codegouvfr/react-dsfr/Pagination";
import { Table, type TableProps } from "@codegouvfr/react-dsfr/Table";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStyles } from "tss-react/dsfr";
import { useBreakpoint } from "../../../helpers/layout";
import { useDebounce, useScrollTo } from "../../hooks";
import { Loader } from "../loader";
import { RichDropdown, type RichDropdownProps } from "../rich-dropdown";
import Styles from "./RichTable.styles";

type RichTableProps = {
  headers: TableProps["headers"];
  data: TableProps["data"];
  dropdownFilters?: {
    items: RichDropdownProps[];
    onSubmit: () => void;
  };
  searchBar?: {
    label: string;
    placeholder: string;
    hintText?: string;
    onSubmit: (value: string) => void;
  };
  pagination: PaginationProps;
  isLoading: boolean;
  className?: string;
};

export const RichTable = ({
  headers,
  data,
  dropdownFilters,
  searchBar,
  pagination,
  isLoading,
  className,
}: RichTableProps) => {
  const { cx } = useStyles();
  const isFixedOnDesktop = useBreakpoint("lg");
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 500);
  const searchBarRefOnSubmitRef = useRef(searchBar?.onSubmit).current;
  const tableRef = useRef<HTMLTableElement>(null);

  useScrollTo(pagination.defaultPage ?? 1);

  useLayoutEffect(() => {
    tableRef.current?.querySelectorAll("th").forEach((th) => {
      if (th.textContent?.includes("Date")) {
        th.classList.add("has-date-text");
      }
    });
  }, []);

  useEffect(() => {
    searchBarRefOnSubmitRef?.(debouncedSearchValue);
  }, [debouncedSearchValue, searchBarRefOnSubmitRef]);

  return (
    <section
      role="tabpanel"
      aria-label="Listing des candidatures"
      className={cx(Styles.root, className)}
    >
      {isLoading && <Loader />}
      <header className={cx(Styles.header)}>
        {searchBar && (
          <form
            onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const query = formData.get("search");
              if (query && typeof query === "string") {
                searchBar.onSubmit(query);
              }
            }}
            className={fr.cx("fr-grid-row", "fr-search-bar")}
          >
            <div className={fr.cx("fr-col-lg-7")}>
              <Input
                label={searchBar.label}
                nativeInputProps={{
                  placeholder: searchBar.placeholder,
                  role: "search",
                  name: "search",
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    setSearchValue(event.target.value);
                  },
                }}
                className={fr.cx("fr-mb-0")}
              />
              {searchBar.hintText && (
                <span className={fr.cx("fr-hint-text", "fr-mt-1w")}>
                  {searchBar.hintText}
                </span>
              )}
            </div>
            <Button type="submit">Rechercher</Button>
          </form>
        )}
        {dropdownFilters && (
          <form
            onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              dropdownFilters.onSubmit();
            }}
            className={cx(Styles.dropdowns)}
          >
            {dropdownFilters?.items.map((dropdownFilter) => (
              <RichDropdown
                {...dropdownFilter}
                as="Tag"
                key={dropdownFilter.id}
              />
            ))}
          </form>
        )}
      </header>

      <Table
        ref={tableRef}
        headers={headers}
        data={data}
        bordered={false}
        fixed={isFixedOnDesktop}
      />
      <Pagination {...pagination} />
    </section>
  );
};
