import { z } from 'zod';

const frontendEnvSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Hirgal'),
  VITE_API_BASE_URL: z
    .string()
    .url()
    .default('http://127.0.0.1:8000/api/v1')
    .transform((value) => value.replace(/\/+$/, ''))
    .refine((value) => new URL(value).pathname.endsWith('/api/v1'), {
      message: 'VITE_API_BASE_URL must end in /api/v1.',
    }),
});

const parsedEnv = frontendEnvSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((issue) => issue.message).join(' ');
  throw new Error(`Invalid frontend environment configuration: ${issues}`);
}

export const appConfig = {
  name: parsedEnv.data.VITE_APP_NAME,
  apiBaseUrl: parsedEnv.data.VITE_API_BASE_URL,
} as const;
