export type FormActionResult = {
  status: "idle" | "success" | "error"
  message: string
}

export const IDLE_FORM_ACTION_RESULT: FormActionResult = {
  status: "idle",
  message: "",
}

export function successResult(message: string): FormActionResult {
  return {
    status: "success",
    message,
  }
}

export function errorResult(message: string): FormActionResult {
  return {
    status: "error",
    message,
  }
}
