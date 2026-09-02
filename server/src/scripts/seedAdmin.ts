import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDatabase } from "../config/database";
import { User } from "../models/User";

dotenv.config();

async function seedAdmin() {
  await connectDatabase();

  const email = process.env.ADMIN_EMAIL || "admin@queenb.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const username = process.env.ADMIN_USERNAME || "מנהלת קהילה";

  const passwordHash = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { email },
    {
      email,
      username,
      passwordHash,
      role: "admin",
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log(`Admin user is ready: ${email}`);
}

seedAdmin()
  .catch((error) => {
    console.error("Failed to seed admin user", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
