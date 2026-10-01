export const renderFooter = (customFooter: (() => string) | undefined) =>
  customFooter ? customFooter() : defaultEmailFooter("immersion");

export const defaultEmailFooter = (internshipKind: string) => {
  const bannerUrl =
    internshipKind === "immersion"
      ? "https://immersion.cellar-c2.services.clever-cloud.com/email_footer.png"
      : "https://immersion.cellar-c2.services.clever-cloud.com/4d9947da-214f-43ef-963d-6830cb0f3864.png";
  return `
  <table>
  <tr>
    <td height="30"></td>
  </tr>
  <tr>
    <td width="600" style="background-color: #F5F5FE; text-align: center; padding: 20px 50px; ">
      <p style="font-size: 14px;">Vous recevez cet email, car cette adresse email a été renseignée sur le site Immersion Facilitée dans une demande de convention ou de connexion. Si vous rencontrez un problème, la plupart des solutions sont disponibles sur notre <a href="https://immersion-facile.beta.gouv.fr/aide/">centre d'aide</a>. Vous y trouverez également un formulaire de contact pour joindre notre équipe support, qui vous répondra sous les meilleurs délais.</p>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding: 20px;">
      <img src="${bannerUrl}" alt=""/>
    </td>
  </tr>
  </table>`;
};
