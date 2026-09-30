import { fr } from "@codegouvfr/react-dsfr";
import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import {
  Pagination,
  type PaginationProps,
} from "@codegouvfr/react-dsfr/Pagination";
import { SegmentedControl } from "@codegouvfr/react-dsfr/SegmentedControl";
import type { TableProps } from "@codegouvfr/react-dsfr/Table";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useStyles } from "tss-react/dsfr";
import { useLayout } from "../../../helpers/layout";
import { useDebounce, useScrollTo } from "../../hooks";
import { BorderedSection } from "../bordered-section";
import { Loader } from "../loader";
import { ResponsiveTable } from "../responsive-table";
import { RichDropdown, type RichDropdownProps } from "../rich-dropdown";
import Styles from "./RichTable.styles";

type ViewMode = "grid" | "table";

type GridItemProps = {
  badge?: ReactNode;
  id: string;
  title: string;
  subTitle?: string;
  content: ReactNode;
  footerLeftNode: string;
  cta: ButtonProps;
};

type RichTableProps = {
  headers: TableProps["headers"];
  tableData: TableProps["data"];
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
  label: string;
  className?: string;
} & (
  | {
      hasViewSwitch: true;
      gridData: GridItemProps[];
    }
  | {
      hasViewSwitch: false;
      gridData?: never;
    }
);

export const RichTable = ({
  headers,
  tableData,
  gridData,
  dropdownFilters,
  searchBar,
  pagination,
  isLoading,
  hasViewSwitch,
  label,
  className,
}: RichTableProps) => {
  const { cx } = useStyles();
  const { isLayoutDesktop } = useLayout();
  const [selectedViewMode, setSelectedViewMode] = useState<ViewMode>(
    isLayoutDesktop ? "table" : "grid",
  );
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 500);
  const searchBarRefOnSubmitRef = useRef(searchBar?.onSubmit).current;
  const tableRef = useRef<HTMLDivElement>(null);

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
      aria-label={label}
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
        {(dropdownFilters || hasViewSwitch) && (
          <div className={cx(Styles.tools)}>
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
            {hasViewSwitch && (
              <SegmentedControl
                hideLegend
                small
                segments={[
                  {
                    label: "Tableau",
                    iconId: "fr-icon-table-line",
                    nativeInputProps: {
                      checked: selectedViewMode === "table",
                      value: "table",
                      onChange: () => setSelectedViewMode("table"),
                    },
                  },
                  {
                    label: "Grille",
                    iconId: "fr-icon-grid-line",
                    nativeInputProps: {
                      checked: selectedViewMode === "grid",
                      value: "grid",
                      onChange: () => setSelectedViewMode("grid"),
                    },
                  },
                ]}
              />
            )}
          </div>
        )}
      </header>
      {(!hasViewSwitch || selectedViewMode === "table") && (
        <ResponsiveTable
          ref={tableRef}
          headers={headers}
          data={tableData}
          bordered={false}
        />
      )}
      {hasViewSwitch && selectedViewMode === "grid" && (
        <div
          className={fr.cx(
            "fr-grid-row",
            "fr-grid-row--gutters",
            "fr-mt-1w",
            "fr-mb-2w",
          )}
        >
          {gridData.map((gridItem) => (
            <div
              key={gridItem.id}
              className={fr.cx("fr-col-12", "fr-col-lg-4")}
            >
              <BorderedSection>
                {gridItem.badge}
                <h3 className={fr.cx("fr-h6", "fr-mb-0")}>{gridItem.title}</h3>
                <span className={fr.cx("fr-text--xs")}>
                  {gridItem.subTitle}
                </span>
                <div>{gridItem.content}</div>
                <hr className={fr.cx("fr-hr", "fr-mt-2w", "fr-pb-2w")} />
                <div className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
                  <span className={fr.cx("fr-hint-text")}>
                    {gridItem.footerLeftNode}
                  </span>
                  <Button
                    className={fr.cx("fr-ml-auto")}
                    size="small"
                    priority="secondary"
                    {...gridItem.cta}
                  />
                </div>
              </BorderedSection>
            </div>
          ))}
        </div>
      )}
      <Pagination {...pagination} />
    </section>
  );
};
