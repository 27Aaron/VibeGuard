"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function AdminSelectAllCheckbox({
  formId,
  inputName,
  label,
}: {
  formId: string;
  inputName: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [checked, setChecked] = useState(false);
  const [disabled, setDisabled] = useState(true);

  const getCheckboxes = useCallback(() => {
    const form = formRef.current;
    if (!form) return [];

    return Array.from(form.elements).filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement &&
        element.type === "checkbox" &&
        element.name === inputName,
    );
  }, [inputName]);

  const syncState = useCallback(() => {
    const checkboxes = getCheckboxes();
    const count = checkboxes.filter((cb) => cb.checked).length;
    const hasRows = checkboxes.length > 0;

    setChecked(hasRows && count === checkboxes.length);
    setDisabled(!hasRows);

    if (inputRef.current) {
      inputRef.current.indeterminate = count > 0 && count < checkboxes.length;
    }
  }, [getCheckboxes]);

  useEffect(() => {
    formRef.current = document.getElementById(formId) as HTMLFormElement | null;
    syncState();

    function handleChange(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.form?.id === formId && target.name === inputName) {
        syncState();
      }
    }

    document.addEventListener("change", handleChange);
    return () => {
      document.removeEventListener("change", handleChange);
    };
  }, [formId, inputName, syncState]);

  return (
    <label className="flex cursor-pointer items-center justify-center">
      <input
        ref={inputRef}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          const checkboxes = getCheckboxes();

          checkboxes.forEach((checkbox) => {
            checkbox.checked = nextChecked;
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          });

          setChecked(nextChecked);
          if (inputRef.current) {
            inputRef.current.indeterminate = false;
          }
        }}
      />
    </label>
  );
}
