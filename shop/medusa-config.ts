import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:3000",
      jwtSecret: process.env.JWT_SECRET || "supersecret-dev-jwt",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret-dev-cookie",
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    // Stripe payment provider
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              capture: true,
              automatic_payment_methods: true,
            },
          },
        ],
      },
    },
    // SendGrid for email notifications (optional — enable when ready)
    // {
    //   resolve: "@medusajs/medusa/notification",
    //   options: {
    //     providers: [
    //       {
    //         resolve: "@medusajs/medusa/notification-sendgrid",
    //         id: "sendgrid",
    //         options: {
    //           apiKey: process.env.SENDGRID_API_KEY,
    //           from: process.env.SENDGRID_FROM || "shop@1tt.dev",
    //         },
    //       },
    //     ],
    //   },
    // },
  ],
});
