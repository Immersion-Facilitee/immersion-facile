import type { ReactElement } from "react";
import {
  ConnectedPrivateRoutePage,
  type FrontDashboardRoute,
} from "src/app/pages/auth/ConnectedPrivateRoutePage";

type DashboardPrivateRoutePageProps = {
  route: FrontDashboardRoute;
  children: ReactElement;
};

export const DashboardPrivateRoutePage = ({
  route,
  children,
}: DashboardPrivateRoutePageProps) => (
  <ConnectedPrivateRoutePage route={route}>
    {children}
  </ConnectedPrivateRoutePage>
);
