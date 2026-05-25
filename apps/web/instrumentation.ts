import { validateRequiredEnv } from "@vibeguard/shared";

export async function register() {
  validateRequiredEnv();
}
