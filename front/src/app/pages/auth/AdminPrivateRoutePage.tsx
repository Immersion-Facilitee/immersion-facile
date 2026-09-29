import type { ReactNode } from "react";
import {
  ConnectedPrivateRoutePage,
  type FrontAdminRoute,
} from "src/app/pages/auth/ConnectedPrivateRoutePage";

type AdminPrivateRoutePageProps = {
  route: FrontAdminRoute;
  children: ReactNode;
};

export const AdminPrivateRoutePage = ({
  route,
  children,
}: AdminPrivateRoutePageProps) => (
  <ConnectedPrivateRoutePage allowAdminOnly={true} route={route}>
    {children}
  </ConnectedPrivateRoutePage>
);
