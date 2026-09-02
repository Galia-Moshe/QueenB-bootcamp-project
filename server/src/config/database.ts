import mongoose from "mongoose";

export async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/queenb-match";

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
}
