import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { ConglomerateModel } from "../src/models/conglomerate";
import { HotelBrandModel } from "../src/models/hotelBrand";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/postcardcrm";

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        // 1. Seed Hotel Brands
        const brands = [
            { name: "Taj Hotels", category: "LUXURY" },
            { name: "The Oberoi", category: "LUXURY" },
            { name: "ITC Hotels", category: "LUXURY" },
            { name: "Marriott", category: "UPPER_UPSCALE" },
            { name: "Hilton", category: "UPPER_UPSCALE" },
            { name: "Hyatt", category: "UPPER_UPSCALE" },
            { name: "Le Meridien", category: "UPPER_UPSCALE" },
            { name: "Lemon Tree", category: "MID_SEGMENT" },
            { name: "FabHotels", category: "BUDGET" },
            { name: "Treebo", category: "BUDGET" },
            { name: "Ginger Hotels", category: "BUDGET" },
            { name: "ibis", category: "MID_SEGMENT" },
            { name: "Novotel", category: "UPSCALE" },
            { name: "Westin", category: "UPPER_UPSCALE" },
            { name: "Sheraton", category: "UPPER_UPSCALE" },
            { name: "Radisson Blue", category: "UPPER_UPSCALE" },
            { name: "Vivanta", category: "UPSCALE" },
        ];

        for (const brand of brands) {
            await HotelBrandModel.findOneAndUpdate(
                { name: brand.name },
                { $set: brand },
                { upsert: true, new: true }
            );
        }
        console.log("Hotel brands seeded.");

        // 2. Seed Conglomerates from file
        const congFilePath = path.join(__dirname, "../conglomerates.txt");
        if (fs.existsSync(congFilePath)) {
            const content = fs.readFileSync(congFilePath, "utf8");
            const lines = content.split("\n");

            let currentCountry = "India"; // Default
            let currentRegion = "Asia"; // Default

            const conglomeratesToSeed = [];

            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                // Check if it's a country header (heuristic: no bullet point)
                if (!line.includes("•") && line.length < 30) {
                    // Check for regions
                    if (["Africa", "Asia", "Europe", "North America", "South America", "Oceania"].includes(line)) {
                        currentRegion = line;
                    } else {
                        currentCountry = line;
                    }
                    continue;
                }

                // It's a conglomerate
                if (line.includes("•")) {
                    const name = line.replace("•", "").trim();
                    if (name) {
                        conglomeratesToSeed.push({
                            name,
                            country: currentCountry,
                            region: currentRegion,
                            isActive: true,
                            isGlobal: ["Tata Group", "Reliance Industries Limited", "Adani Group", "Samsung", "Apple", "Microsoft", "Alphabet", "Amazon", "Tesla", "Toyota", "Disney", "LVMH"].includes(name)
                        });
                    }
                }
            }

            console.log(`Parsed ${conglomeratesToSeed.length} conglomerates. Seeding...`);

            // Batch upsert or just insertMany if empty
            // To avoid duplicates if rerun, we'll do individual upserts or a smarter batch
            for (const cong of conglomeratesToSeed) {
                await ConglomerateModel.findOneAndUpdate(
                    { name: cong.name, country: cong.country },
                    { $set: cong },
                    { upsert: true }
                );
            }
            console.log("Conglomerates seeded.");
        } else {
            console.log("conglomerates.txt not found, skipping conglomerate seeding.");
        }

        console.log("Seeding completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
}

seed();
