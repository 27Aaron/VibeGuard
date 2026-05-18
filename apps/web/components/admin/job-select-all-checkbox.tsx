"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function getJobCheckboxes(formId: string, inputName: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][form="${formId}"][name="${inputName}"]`,
    ),
  )
}

export function JobSelectAllCheckbox({
  formId,
  inputName,
  label,
}: {
  formId: string
  inputName: string
  label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [checked, setChecked] = useState(false)
  const [disabled, setDisabled] = useState(true)

  const syncState = useCallback(() => {
    const checkboxes = getJobCheckboxes(formId, inputName)
    const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length
    const hasRows = checkboxes.length > 0

    setChecked(hasRows && checkedCount === checkboxes.length)
    setDisabled(!hasRows)

    if (inputRef.current) {
      inputRef.current.indeterminate =
        checkedCount > 0 && checkedCount < checkboxes.length
    }
  }, [formId, inputName])

  useEffect(() => {
    syncState()

    function handleChange(event: Event) {
      const target = event.target

      if (!(target instanceof HTMLInputElement)) {
        return
      }

      if (target.form?.id === formId && target.name === inputName) {
        syncState()
      }
    }

    document.addEventListener("change", handleChange)

    return () => {
      document.removeEventListener("change", handleChange)
    }
  }, [formId, inputName, syncState])

  return (
    <label className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-black/8 bg-[#eef2f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:bg-[#e7ecf4] focus-within:ring-2 focus-within:ring-emerald-700/20 has-disabled:cursor-not-allowed has-disabled:opacity-40 dark:border-white/8 dark:bg-[#11161d] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:focus-within:ring-emerald-200/20">
      <input
        ref={inputRef}
        aria-label={label}
        checked={checked}
        className="size-4 cursor-pointer rounded border-black/20 accent-emerald-800 disabled:cursor-not-allowed dark:border-white/20 dark:accent-emerald-300"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked

          getJobCheckboxes(formId, inputName).forEach((checkbox) => {
            checkbox.checked = nextChecked
            checkbox.dispatchEvent(new Event("change", { bubbles: true }))
          })

          syncState()
        }}
      />
    </label>
  )
}
