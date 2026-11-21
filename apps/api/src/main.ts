import { PrismaPg } from "@prisma/adapter-pg";
import { buildApp } from "./app.js";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaReservationRepository } from "./reservations/reservation.prisma.repository.js";
import { RESOURCES } from "./resources/resource.data.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to apps/api/.env or export it.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const app = buildApp({
  resources: RESOURCES,
  repository: new PrismaReservationRepository(prisma),
  logger: { level: "error" },
});

app.addHook("onClose", () => prisma.$disconnect());

await app.listen({ port, host: "0.0.0.0" });
console.log(`Reservations API listening on http://localhost:${port}`);
