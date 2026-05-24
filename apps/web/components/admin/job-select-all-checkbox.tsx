import { AdminSelectAllCheckbox } from "@/components/admin/admin-select-all-checkbox";

export function JobSelectAllCheckbox({
  formId,
  inputName,
  label,
}: {
  formId: string;
  inputName: string;
  label: string;
}) {
  return (
    <AdminSelectAllCheckbox
      formId={formId}
      inputName={inputName}
      label={label}
    />
  );
}
