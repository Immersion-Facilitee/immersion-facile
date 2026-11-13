import { type FrIconClassName, fr } from "@codegouvfr/react-dsfr";
import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import Tag from "@codegouvfr/react-dsfr/Tag";

import {
  type ElementRef,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useStyles } from "tss-react/dsfr";
import { prefix } from "../rs-autocomplete";
import Styles from "./RichDropdown.styles";

export type RichDropdownProps = {
  defaultValue: string;
  values: string[];
  submenu: {
    title: string;
    content: ReactNode;
  };
  iconId: FrIconClassName;
  onReset?: () => void;
  className?: string;
  id?: string;
  as?: "Tag" | "Button";
  noButtons?: boolean;
  submenuPosition?: "bottom-left" | "bottom-right";
};

const getElementParentsClasses = (
  element: Element,
  parents: string[] = [],
): string[] => {
  if (element.parentElement) {
    return getElementParentsClasses(element.parentElement, [
      ...parents,
      ...element.classList,
    ]);
  }
  return parents;
};

export const RichDropdown = ({
  defaultValue,
  values,
  submenu,
  iconId,
  className,
  id,
  onReset,
  as = "Tag",
  noButtons = false,
  submenuPosition = "bottom-left",
}: RichDropdownProps) => {
  const { cx } = useStyles();
  const [isOpened, setIsOpened] = useState<boolean>(false);
  const hasValue = values && values.length > 0;
  const wrapperElement = useRef<ElementRef<"div">>(null);
  const ButtonComponent = as === "Tag" ? Tag : Button;
  useLayoutEffect(() => {
    if (
      isOpened &&
      wrapperElement.current &&
      wrapperElement.current.querySelectorAll(`.${prefix}__control--is-focused`)
        .length === 0 &&
      wrapperElement.current.querySelector("input")
    ) {
      const input = wrapperElement.current.querySelector("input");
      if (input && input.value === "") {
        input.focus();
      }
    }
    document.body.addEventListener("click", handleClickOutside);
  });
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    const hasClickedInAutocompleteOption = getElementParentsClasses(
      target,
    ).includes("MuiAutocomplete-option");
    const hasClickedInIndicators = target
      .getAttribute("id")
      ?.includes("react-select");
    if (
      isOpened &&
      wrapperElement.current &&
      !wrapperElement.current.contains(target) &&
      !hasClickedInAutocompleteOption &&
      !hasClickedInIndicators
    ) {
      setIsOpened(false);
    }
  };

  const buttons: [ButtonProps, ...ButtonProps[]] = [
    {
      children: "Annuler",
      type: "button",
      priority: "secondary",
      onClick: () => setIsOpened(false),
      className: fr.cx("fr-mb-0"),
      id: `${id}-cancel-button`,
    },
    {
      children: "Appliquer",
      type: "submit",
      onClick: () => setIsOpened(false),
      className: fr.cx("fr-mb-0"),
      id: `${id}-submit-button`,
    },
  ];
  if (onReset) {
    buttons.unshift({
      children: "Réinitialiser",
      type: "button",
      priority: "tertiary",
      onClick: () => {
        onReset();
        setIsOpened(false);
      },
      className: fr.cx("fr-mb-0"),
      disabled: !hasValue,
      id: `${id}-reset-button`,
    });
  }

  return (
    <div
      className={cx(
        Styles.root,
        submenuPosition === "bottom-right" && Styles.openedBottomRight,
      )}
      ref={wrapperElement}
    >
      <ButtonComponent
        iconId={iconId}
        className={className}
        id={id}
        nativeButtonProps={{
          onClick: (event) => {
            event.preventDefault();
            setIsOpened(true);
          },
        }}
        {...(as === "Button" && {
          priority: "secondary",
        })}
      >
        {hasValue ? values.join(", ") : defaultValue}
      </ButtonComponent>
      <section
        className={cx(
          fr.cx("fr-p-3w", isOpened ? "fr-unhidden" : "fr-hidden"),
          Styles.submenu,
        )}
      >
        <p className={fr.cx("fr-text--bold")}>{submenu.title}</p>
        {submenu.content}
        {!noButtons && (
          <ButtonsGroup
            className={fr.cx("fr-hr", "fr-pt-2w", "fr-pb-0")}
            inlineLayoutWhen="always"
            alignment="right"
            buttons={buttons}
          />
        )}
      </section>
    </div>
  );
};
