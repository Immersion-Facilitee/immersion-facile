import { Table, type TableProps } from "@codegouvfr/react-dsfr/Table";
import { forwardRef } from "react";
import { useLayout } from "../../../helpers/layout";

export type ResponsiveTableProps = Omit<TableProps, "fixed">;

export const ResponsiveTable = forwardRef<HTMLDivElement, ResponsiveTableProps>(
  (props, ref) => {
    const { isLayoutDesktop } = useLayout();
    return <Table {...props} ref={ref} fixed={isLayoutDesktop} />;
  },
);
