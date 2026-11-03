import { AdminConventionListSection } from "src/app/components/admin/conventions/AdminConventionListSection";
import { ArchivedConventionListSection } from "../../components/admin/archived-conventions/ArchivedConventionListSection";

export const ConventionTab = (): React.ReactNode => (
  <>
    <AdminConventionListSection />
    <ArchivedConventionListSection />
  </>
);
