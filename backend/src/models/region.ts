import { Schema, model, Document } from "mongoose";
import { ObjectId, PropertyRef } from "./common";

export interface IRegion extends Document {
  name: string;
  properties: ObjectId[];
}

const regionSchema = new Schema<IRegion>(
  {
    name: { type: String, required: true, unique: true },
    properties: [PropertyRef],
  },
  { timestamps: true }
);

export const RegionModel = model<IRegion>("Region", regionSchema);



