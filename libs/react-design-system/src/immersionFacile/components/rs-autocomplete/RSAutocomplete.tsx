import { fr } from "@codegouvfr/react-dsfr";
import type { InputProps } from "@codegouvfr/react-dsfr/Input";
import Select, {
  type AriaGuidanceProps,
  type AriaOnChangeProps,
  type AriaOnFilterProps,
  type AriaOnFocusProps,
  type GroupBase,
  type OptionProps,
  type OptionsOrGroups,
  type Props as SelectProps,
} from "react-select";
import { useStyles } from "tss-react/dsfr";
import type { Capitalize } from "../../utils";
import Styles from "./RSAutocomplete.styles";

export type OptionType<T> = { value: T; label: string };

export type RSAutocompleteProps<T, L> = InputProps.Common &
  InputProps.RegularInput & {
    selectProps?: SelectProps<
      OptionType<T>,
      false,
      GroupBase<OptionType<T>>
    > & {
      isDebouncing?: boolean;
    };
    initialInputValue?: string;
    locator: L;
    multiple?: boolean;
  };

export type RSAutocompleteComponentProps<
  K extends string,
  T,
  L,
> = RSAutocompleteProps<T, L> &
  Record<`on${Capitalize<K>}Selected`, (value: T) => void> &
  Record<`on${Capitalize<K>}Clear`, () => void>;

export const prefix = "im-select";

// Translated from defaultAriaLiveMessages : https://github.com/JedWatson/react-select/blob/master/packages/react-select/src/accessibility/index.ts
const frenchAriaLiveMessages = {
  guidance: (props: AriaGuidanceProps) => {
    const { isSearchable, isMulti, tabSelectsValue, context, isInitialFocus } =
      props;
    switch (context) {
      case "menu":
        return `Utilisez Haut et Bas pour choisir une option, appuyez sur Entrée pour sélectionner l'option ayant le focus, appuyez sur Échap pour quitter le menu${
          tabSelectsValue
            ? ", appuyez sur Tabulation pour sélectionner l'option et quitter le menu"
            : ""
        }.`;
      case "input":
        return isInitialFocus
          ? `${props["aria-label"] || "Sélection"} a le focus${
              isSearchable ? ", saisissez pour affiner la liste" : ""
            }, appuyez sur Bas pour ouvrir le menu, ${
              isMulti
                ? " appuyez sur Gauche pour déplacer le focus sur les valeurs sélectionnées"
                : ""
            }`
          : "";
      case "value":
        return "Utilisez Gauche et Droite pour naviguer entre les valeurs ayant le focus, appuyez sur Retour arrière pour supprimer la valeur actuellement ciblée";
      default:
        return "";
    }
  },

  onChange: <Option, IsMulti extends boolean>(
    props: AriaOnChangeProps<Option, IsMulti>,
  ) => {
    const { action, label = "", labels, isDisabled } = props;
    switch (action) {
      case "deselect-option":
      case "pop-value":
      case "remove-value":
        return `option ${label}, désélectionnée.`;
      case "clear":
        return "Toutes les options sélectionnées ont été effacées.";
      case "initial-input-focus":
        return `option${labels.length > 1 ? "s" : ""} ${labels.join(
          ",",
        )}, sélectionnée${labels.length > 1 ? "s" : ""}.`;
      case "select-option":
        return isDisabled
          ? `option ${label} est désactivée. Sélectionnez une autre option.`
          : `option ${label}, sélectionnée.`;
      default:
        return "";
    }
  },

  onFocus: <Option, Group extends GroupBase<Option>>(
    props: AriaOnFocusProps<Option, Group>,
  ) => {
    const {
      context,
      focused,
      options,
      label = "",
      selectValue,
      isDisabled,
      isSelected,
      isAppleDevice,
    } = props;

    const getArrayIndex = (
      arr: OptionsOrGroups<Option, Group>,
      item: Option,
    ): string =>
      arr && arr.length ? `${arr.indexOf(item) + 1} sur ${arr.length}` : "";

    if (context === "value" && selectValue) {
      return `valeur ${label} a le focus, ${getArrayIndex(selectValue, focused)}.`;
    }

    if (context === "menu" && isAppleDevice) {
      const disabled = isDisabled ? " désactivée" : "";
      const status = `${isSelected ? " sélectionnée" : ""}${disabled}`;
      return `${label}${status}, ${getArrayIndex(options, focused)}.`;
    }
    return "";
  },

  onFilter: (props: AriaOnFilterProps) => {
    const { inputValue, resultsMessage } = props;
    return `${resultsMessage}${
      inputValue ? " pour le terme de recherche " + inputValue : ""
    }.`;
  },
};

const frenchScreenReaderStatus = ({ count }: { count: number }): string =>
  `${count} résultat${count !== 1 ? "s" : ""} disponible${count !== 1 ? "s" : ""}`;

export const RSAutocomplete = <T, L>({
  state,
  stateRelatedMessage,
  label,
  hintText,
  className,
  selectProps,
}: RSAutocompleteProps<T, L>) => {
  const { cx } = useStyles();
  const CustomizedOption = selectProps?.components?.Option;
  return (
    <div
      className={cx(fr.cx("fr-input-group"), className)}
      id={selectProps?.id ?? `${selectProps?.inputId}-wrapper`}
    >
      <label className={fr.cx("fr-label")} htmlFor={selectProps?.inputId}>
        {label}
        {hintText && <span className="fr-hint-text">{hintText}</span>}
      </label>
      <Select
        {...selectProps}
        classNamePrefix={prefix}
        className={cx(
          `${prefix}`,
          state === "error" ? "im-select--has-error" : "",
        )}
        unstyled
        defaultInputValue={selectProps?.defaultInputValue}
        value={selectProps?.value}
        placeholder={selectProps?.placeholder}
        loadingMessage={selectProps?.loadingMessage || (() => <>...</>)}
        inputId={selectProps?.inputId}
        filterOption={() => true}
        classNames={{
          input: () =>
            fr.cx("fr-input", { "fr-input--error": state === "error" }),
          menu: () => cx(fr.cx("fr-menu", "fr-p-0", "fr-m-0"), Styles.menu),
          menuList: () =>
            cx(fr.cx("fr-menu__list", "fr-mb-0"), Styles.menuList),
          option: () => cx(fr.cx("fr-nav__link")),
          control: () => cx(fr.cx("fr-mt-1w")),
        }}
        components={{
          DropdownIndicator: () => null,
          ...(CustomizedOption
            ? {
                Option: (
                  props: OptionProps<
                    OptionType<T>,
                    false,
                    GroupBase<OptionType<T>>
                  >,
                ) => <CustomizedOption {...props} />,
              }
            : {}),
        }}
        noOptionsMessage={
          selectProps?.noOptionsMessage ||
          (({ inputValue }) => {
            if (inputValue.length < 3) return "Saisissez au moins 3 caractères";
            if (selectProps?.isLoading || selectProps?.isDebouncing)
              return selectProps?.loadingMessage ? (
                selectProps.loadingMessage({ inputValue })
              ) : (
                <>Recherche en cours...</>
              );
            return <>Aucune suggestion trouvée pour {inputValue}</>;
          })
        }
        ariaLiveMessages={{
          ...frenchAriaLiveMessages,
          ...selectProps?.ariaLiveMessages,
        }}
        screenReaderStatus={
          selectProps?.screenReaderStatus ?? frenchScreenReaderStatus
        }
        hideSelectedOptions
        isClearable
        id={`${selectProps?.inputId}-wrapper`}
      />
      {state === "info" && (
        <p className="fr-info-text">{stateRelatedMessage}</p>
      )}
      {state === "error" && (
        <p className="fr-error-text">{stateRelatedMessage}</p>
      )}
    </div>
  );
};
