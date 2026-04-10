import { connect } from 'mongoose';
import { PropertyModel } from './src/models/property';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function main() {
  await connect(process.env.MONGO_URI || "mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/moustache_crm?retryWrites=true&w=majority&appName=Cluster0");
  const p = await PropertyModel.findById("69ba5591799bf030486dca96").lean();
  
  if (!p) {
     console.log("No prop found for that ID!"); process.exit(1);
  }

  console.log("Found Property Name:", p.name);
  console.log("Has PMS Config?", !!p.pmsConfig);
  process.exit();
}
main();
