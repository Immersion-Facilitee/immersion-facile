import { fr } from "@codegouvfr/react-dsfr";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { keys } from "ramda";
import { type ReactNode, useEffect, useState } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import type {
  EmailNotification,
  EmailVariables,
  Notification,
  NotificationKind,
  SmsNotification,
  SmsVariables,
} from "shared";
import { TextCell } from "src/app/components/admin/TextCell";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { adminSelectors } from "src/core-logic/domain/admin/admin.selectors";
import { notificationsSlice } from "src/core-logic/domain/admin/notifications/notificationsSlice";

export const NotificationsTab = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(notificationsSlice.actions.getLastNotificationsRequested());
    return () => {
      dispatch(notificationsSlice.actions.clearNotificationsRequested());
    };
  }, [dispatch]);
  const latestEmails = useAppSelector(adminSelectors.notifications.emails);
  const latestSms = useAppSelector(adminSelectors.notifications.sms);
  const errorMessage = useAppSelector(adminSelectors.notifications.error);
  const isLoading = useAppSelector(adminSelectors.notifications.isLoading);

  const [notificationKindToShow, setNotificationKindToShow] =
    useState<NotificationKind>("email");
  if (isLoading) return <Loader />;
  return (
    <BackofficeDashboardTabContent
      title={`Derniers ${
        notificationKindToShow === "email" ? "Emails" : "Sms"
      } envoyés`}
      titleAction={
        <ToggleSwitch
          label={
            notificationKindToShow === "sms"
              ? "Sms (décocher pour voir les emails)"
              : "Emails (cocher pour voir les sms)"
          }
          checked={notificationKindToShow === "sms"}
          showCheckedHint={notificationKindToShow === "sms"}
          onChange={() =>
            setNotificationKindToShow(
              notificationKindToShow === "email" ? "sms" : "email",
            )
          }
        />
      }
      titleActionCols={4}
    >
      {errorMessage ? (
        <Alert title={"Oups..."} severity="error" description={errorMessage} />
      ) : (
        <ul className={fr.cx("fr-accordions-group")}>
          {notificationKindToShow === "email" &&
            latestEmails.map((email) => (
              <li key={email.id}>
                <Email email={email} />
                <hr />
              </li>
            ))}

          {notificationKindToShow === "sms" &&
            latestSms.map((sms) => (
              <li key={sms.id}>
                <Sms sms={sms} />
                <hr />
              </li>
            ))}
        </ul>
      )}
    </BackofficeDashboardTabContent>
  );
};

const DisplayedNotification = ({
  notification,
  children,
}: {
  children: ReactNode;
  notification: Notification;
}) => {
  const notificationDate = new Date(notification.createdAt);
  return (
    <Accordion
      label={`✉️ ${
        notification.templatedContent.kind
      } envoyé le ${notificationDate.toLocaleDateString(
        "fr",
      )} à ${notificationDate.toLocaleTimeString("fr")}`}
      className={`im-email-info-container ${
        "conventionId" in notification.templatedContent.params
          ? `im-email-info-container--convention-${notification.templatedContent.params.conventionId}`
          : ""
      }`}
    >
      <TextCell title="Type" contents={notification.templatedContent.kind} />
      {children}
    </Accordion>
  );
};

const Sms = ({ sms }: { sms: SmsNotification }) => (
  <DisplayedNotification notification={sms}>
    <TextCell
      title="Destinataires"
      contents={sms.templatedContent.recipientPhone}
    />
    <TextCell
      title="Paramètres"
      contents={
        <ul className={fr.cx("fr-text--xs")}>
          {keys(sms.templatedContent.params).map((key: SmsVariables) => {
            const value = (
              sms.templatedContent.params as Record<SmsVariables, string>
            )[key];

            const links: SmsVariables[] = ["shortLink"];

            return (
              <li key={key}>
                {" "}
                <span>{key} :</span>{" "}
                <span style={{ wordWrap: "break-word" }}>
                  {links.includes(key) ? (
                    <a href={value as string}>Lien vers la page</a>
                  ) : (
                    JSON.stringify(value, undefined, 2)
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      }
    />
  </DisplayedNotification>
);
const Email = ({ email }: { email: EmailNotification }) => (
  <DisplayedNotification notification={email}>
    <TextCell
      title="Destinataires"
      contents={email.templatedContent.recipients.join(", ")}
    />
    <TextCell title="CC" contents={email.templatedContent.cc?.join(", ")} />
    <TextCell
      title="Paramètres"
      contents={
        <ul className={fr.cx("fr-text--xs")}>
          {keys(email.templatedContent.params).map((key: EmailVariables) => {
            const value = (
              email.templatedContent.params as Record<EmailVariables, string>
            )[key];

            const links: EmailVariables[] = [
              "agencyLogoUrl",
              "conventionFormUrl",
              "conventionStatusLink",
              "assessmentCreationLink",
              "magicLink",
              "conventionSignatureLink",
              "assessmentSignatureLink",
              "assessmentDocumentLink",
              "unsubscribeToEmailShortLink",
              "registerEstablishmentShortLink",
              "loginLink",
              "manageConventionLink",
            ];

            return (
              <li key={key}>
                {" "}
                <span>{key} :</span>{" "}
                <span style={{ wordWrap: "break-word" }}>
                  {links.includes(key) ? (
                    <a href={value as string}>Lien vers la page</a>
                  ) : (
                    JSON.stringify(value, undefined, 2)
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      }
    />
  </DisplayedNotification>
);
