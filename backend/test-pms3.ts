import { connect } from 'mongoose';
import { PropertyModel } from './src/models/property';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config({ path: './.env' });

async function main() {
  await connect(process.env.MONGO_URI || "mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/moustache_crm?retryWrites=true&w=majority&appName=Cluster0");
  const props = await PropertyModel.find().lean();
  const p = props.find(x => x.name.includes("Jaipur")) as any;
  
  const payload = {
      RES_Request: {
          Request_Type: "Separatesourcemapping",
          Authentication: {
              HotelCode: p.pmsConfig.hotelCode,
              AuthCode: p.pmsConfig.authCode,
          },
      },
  };
  
  const baseUrl = "https://live.ipms247.com/pmsinterface";
  const res = await axios.post(`${baseUrl}/pms_connectivity.php`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
  });
  const data = res.data;
  console.log("Raw JSON:", JSON.stringify(data).substring(0, 500));
  process.exit();
}
main();
