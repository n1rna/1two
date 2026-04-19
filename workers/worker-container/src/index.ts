import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";

interface Env {
  WORKER_CONTAINER: DurableObjectNamespace<WorkerContainer>;
  DATABASE_URL: string;
  INTERNAL_SECRET: string;
  LLM_API_KEY: string;
  LLM_PROVIDER: string;
  LLM_BASE_URL: string;
  LLM_MODEL: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
}

export class WorkerContainer extends Container<Env> {
  defaultPort = 8080;
  // Keep the container alive as long as possible between cron ticks. The
  // minute-by-minute cron (* * * * *) resets the idle timer well before 5m.
  sleepAfter = "5m";
  enableInternet = true;

  constructor(ctx: DurableObject["ctx"], env: Env) {
    super(ctx, env);
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL ?? "",
      INTERNAL_SECRET: env.INTERNAL_SECRET ?? "",
      LLM_API_KEY: env.LLM_API_KEY ?? "",
      LLM_PROVIDER: env.LLM_PROVIDER ?? "",
      LLM_BASE_URL: env.LLM_BASE_URL ?? "",
      LLM_MODEL: env.LLM_MODEL ?? "",
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN ?? "",
      R2_ACCOUNT_ID: env.R2_ACCOUNT_ID ?? "",
      R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID ?? "",
      R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY ?? "",
      R2_BUCKET_NAME: env.R2_BUCKET_NAME ?? "",
      PORT: "8080",
    };
  }

  override onStart() {
    console.log("Worker container started");
  }

  override onStop() {
    console.log("Worker container stopped");
  }

  override onError(error: unknown) {
    console.error("Worker container error:", error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const stub = getContainer(env.WORKER_CONTAINER);
    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      return new Response(`Worker startup failed: ${e}`, { status: 503 });
    }
    return stub.fetch(request);
  },

  // Keep-alive: ping the container's /healthz every minute so River's
  // worker loop + PeriodicJobs run without sleep/wake cycles disrupting them.
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const stub = getContainer(env.WORKER_CONTAINER);
    try {
      await stub.startAndWaitForPorts();
      await stub.fetch(new Request("http://internal/healthz"));
    } catch (e) {
      console.error("Worker keep-alive failed:", e);
    }
  },
};
