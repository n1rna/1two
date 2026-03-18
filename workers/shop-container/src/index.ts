import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";

interface Env {
  SHOP_CONTAINER: DurableObjectNamespace<ShopContainer>;
  DATABASE_URL: string;
  REDIS_URL: string;
  STORE_CORS: string;
  ADMIN_CORS: string;
  AUTH_CORS: string;
  JWT_SECRET: string;
  COOKIE_SECRET: string;
  STRIPE_API_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  MEDUSA_BACKEND_URL: string;
}

export class ShopContainer extends Container<Env> {
  defaultPort = 9000;
  sleepAfter = "5m";
  enableInternet = true;

  constructor(ctx: DurableObject["ctx"], env: Env) {
    super(ctx, env);
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL ?? "",
      REDIS_URL: env.REDIS_URL ?? "",
      STORE_CORS: env.STORE_CORS ?? "",
      ADMIN_CORS: env.ADMIN_CORS ?? "",
      AUTH_CORS: env.AUTH_CORS ?? "",
      JWT_SECRET: env.JWT_SECRET ?? "",
      COOKIE_SECRET: env.COOKIE_SECRET ?? "",
      STRIPE_API_KEY: env.STRIPE_API_KEY ?? "",
      STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET ?? "",
      MEDUSA_BACKEND_URL: env.MEDUSA_BACKEND_URL ?? "",
      NODE_ENV: "production",
    };
  }

  override onStart() {
    console.log("Shop container started");
  }

  override onStop() {
    console.log("Shop container stopped");
  }

  override onError(error: unknown) {
    console.error("Shop container error:", error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const stub = getContainer(env.SHOP_CONTAINER);

    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      return new Response(`Shop container startup failed: ${e}`, { status: 503 });
    }

    return stub.fetch(request);
  },
};
