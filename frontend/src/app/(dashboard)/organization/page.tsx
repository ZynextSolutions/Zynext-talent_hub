import { PageHeader } from "@/components/layout/page-header";
import { OrganizationViews } from "@/components/org-tree/organization-views";

export default function OrganizationPage() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Organization"
        description="Browse hierarchy as a tree or org chart. Drag nodes in tree view to reorganize."
      />
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <OrganizationViews />
      </div>
    </div>
  );
}
