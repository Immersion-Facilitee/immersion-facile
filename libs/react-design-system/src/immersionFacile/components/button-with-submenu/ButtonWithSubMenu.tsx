import { fr } from "@codegouvfr/react-dsfr";
import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { type ElementRef, useLayoutEffect, useRef, useState } from "react";
import { useStyles } from "tss-react/dsfr";
import Styles from "./ButtonWithSubMenu.styles";

export type ButtonWithSubMenuProps = {
  navItems: (ButtonProps & { id: string })[];
  buttonLabel: string;
  buttonIconId: Exclude<ButtonProps["iconId"], undefined>;
  id?: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  floatingMenuOnMobile?: boolean;
  className?: string;
  priority?: ButtonProps["priority"];
  iconPosition?: ButtonProps["iconPosition"];
};

export const ButtonWithSubMenu = ({
  navItems,
  buttonLabel,
  buttonIconId,
  id,
  position,
  floatingMenuOnMobile,
  className,
  priority,
  iconPosition,
}: ButtonWithSubMenuProps) => {
  const buttonId = id ?? "button-with-submenu";
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { cx } = useStyles();
  const toggleButtonRef = useRef<ElementRef<"button">>(null);
  useLayoutEffect(() => {
    document.body.addEventListener("click", (event) => {
      if (
        window.matchMedia(fr.breakpoints.up("lg").replace("@media ", ""))
          .matches &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    });
    window.addEventListener("resize", () => {
      const shouldOpenSubMenu =
        !floatingMenuOnMobile &&
        window.matchMedia(fr.breakpoints.down("lg").replace("@media ", ""))
          .matches;
      setIsOpen(shouldOpenSubMenu);
    });
    return () => {
      document.body.removeEventListener("click", () => {});
      window.removeEventListener("resize", () => {});
    };
  }, []);

  const mobileSuffix = id?.includes("-mobile") ? "-mobile" : "";

  return (
    <div
      className={cx(
        Styles.root,
        isOpen && Styles.isOpened,
        floatingMenuOnMobile && Styles.floating,
        position === "top-right" && Styles.openedTopRight,
        position === "top-left" && Styles.openedTopLeft,
        position === "bottom-right" && Styles.openedBottomRight,
        position === "bottom-left" && Styles.openedBottomLeft,
      )}
    >
      <Button
        ref={toggleButtonRef}
        className={cx(fr.cx("fr-m-md-0"), className)}
        id={buttonId}
        nativeButtonProps={{
          "aria-controls": `${buttonId}-submenu`,
          type: "button",
        }}
        onClick={() => setIsOpen((isOpen) => !isOpen)}
        priority={priority ?? "tertiary"}
        iconId={buttonIconId}
        iconPosition={iconPosition ?? "left"}
      >
        {buttonLabel}
      </Button>

      <div
        className={cx(fr.cx("fr-menu"), Styles.menu)}
        id={`${buttonId}-submenu`}
        aria-hidden={!isOpen}
      >
        <ul
          className={cx(
            fr.cx("fr-menu__list", "fr-p-0", "fr-mb-0"),
            Styles.list,
          )}
        >
          {navItems.map((item) => {
            return (
              <li key={item.id} className={fr.cx("fr-p-0")}>
                {item.linkProps ? (
                  <a
                    className={fr.cx("fr-nav__link")}
                    {...item.linkProps}
                    id={`${item.linkProps.id ?? item.id}${mobileSuffix}`}
                  >
                    {item.children}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={fr.cx("fr-nav__link")}
                    {...item.nativeButtonProps}
                    onClick={item?.onClick ? item?.onClick : undefined}
                    id={`${item.id}${mobileSuffix}`}
                  >
                    {item.children}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
