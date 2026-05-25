type EnvSource = NodeJS.ProcessEnv;

type EnvCheck = {
  key: string;
  required: boolean;
  validate?: (value: string) => string | undefined;
};

const REQUIRED_ENV_CHECKS: readonly EnvCheck[] = [
  { key: "DATABASE_URL", required: true },
  { key: "VIBEGUARD_SECRET", required: true },
  { key: "ADMIN_PASSWORD", required: true },
];

function validateEnvValue(check: EnvCheck, value: string | undefined) {
  if (!value || !value.trim()) {
    if (check.required) return `  - ${check.key} is missing`;
    return undefined;
  }
  return check.validate?.(value);
}

export function validateRequiredEnv(env: EnvSource = process.env): void {
  const errors: string[] = [];

  for (const check of REQUIRED_ENV_CHECKS) {
    const error = validateEnvValue(check, env[check.key]);
    if (error) errors.push(error);
  }

  if (errors.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${errors.join("\n")}\n\nCheck .env.example for the full list.`,
    );
  }
}
