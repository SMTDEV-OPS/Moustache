import { connect } from 'mongoose';
import { PropertyModel } from './src/models/property';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config({ path: './.env' });

async function main() {
  await connect(process.env.MONGO_URI || "mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/moustache_crm?retryWrites=true&w=majority&appName=Cluster0");
  const props = await PropertyModel.find().lean();
  const p = props.find(x => x.name.includes("Jaipur")) as any;
  
  try {
    const res = await axios.get(`http://localhost:4000/v1/pms/${p._id}/ezee/mapping`);
    console.log("Endpoint via 4000/v1/pms:", res.data);
  } catch(e: any) {
    console.log("Error 4000/v1/pms:", e.message);
  }
  
  try {
    const res = await axios.get(`http://localhost:4000/pms/${p._id}/ezee/mapping`);
    console.log("Endpoint via 4000/pms:", res.data?.ratePlans?.length);
  } catch(e: any) {
    console.log("Error 4000/pms:", e.message);
  }

  process.exit();
}
main();
