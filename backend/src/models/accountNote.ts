import { Schema, model, Document, Types } from "mongoose";

export interface IAccountNote extends Document {
  accountId: Types.ObjectId;
  content: string;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const accountNoteSchema = new Schema<IAccountNote>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

accountNoteSchema.index({ accountId: 1, createdAt: -1 });

export const AccountNoteModel = model<IAccountNote>("AccountNote", accountNoteSchema);
