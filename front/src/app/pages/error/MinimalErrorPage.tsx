import Header from "@codegouvfr/react-dsfr/Header";
import { useIsDark } from "@codegouvfr/react-dsfr/useIsDark";
import { MainWrapper, useLayout } from "react-design-system";
import { LayoutFooter } from "src/app/components/layout/LayoutFooter";
import { LayoutHeader } from "src/app/components/layout/LayoutHeader";
import { ErrorPageContent } from "src/app/pages/error/ErrorPageContent";
import { ContactUsButton } from "src/app/pages/error/front-errors";
import { makeStyles } from "tss-react/dsfr";
import immersionFacileLightLogo from "/assets/img/logo-if.svg";
import immersionFacileDarkLogo from "/assets/img/logo-if-dark.svg";

export const MinimalErrorPage = ({ error }: { error: Error }) => {
  const darkModeState = useIsDark();
  const { isLayoutDesktop } = useLayout();

  const { classes } = makeStyles({ name: LayoutHeader.displayName })(() => ({
    operator: {
      boxSizing: "content-box",
      width: isLayoutDesktop ? "10.5rem" : "100%",
      maxWidth: "10.5rem !important",
    },
  }))();
  const immersionFacileLogo = darkModeState.isDark
    ? immersionFacileDarkLogo
    : immersionFacileLightLogo;
  return (
    <>
      <Header
        classes={classes}
        brandTop={
          <>
            République
            <br />
            Française
          </>
        }
        homeLinkProps={{
          href: "/",
          title: "Immersion Facilitée - Accueil",
        }}
        operatorLogo={{
          orientation: "horizontal",
          imgUrl: immersionFacileLogo,
          alt: "Immersion Facilitée - Faciliter la réalisation des immersions professionnelles",
        }}
      />
      <MainWrapper layout="default" vSpacing={8}>
        <ErrorPageContent
          buttons={[
            <ContactUsButton priority="primary" key={ContactUsButton.name} />,
          ]}
          title="Erreur inattendue"
          description={
            <>
              <p>
                Notre site rencontre actuellement un problème technique
                empêchant son utilisation. Notre équipe fait tout son possible
                pour rétablir la situation.
              </p>
              <p>
                Nous vous remercions pour votre patience et nous excusons pour
                la gêne occasionnée.
              </p>
            </>
          }
        />
      </MainWrapper>
      <LayoutFooter />
    </>
  );
};
