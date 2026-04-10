import { connect } from 'mongoose';
import { EzeePMSService } from './src/services/pms/adapters/EzeePMSService';
import { PropertyModel } from './src/models/property';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function main() {
  await connect(process.env.MONGO_URI || "mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/moustache_crm?retryWrites=true&w=majority&appName=Cluster0");
  const props = await PropertyModel.find().lean();
  const p = props.find(x => x.name.includes("Jaipur"));
  if (!p) return console.log("No prop");
  
  const pms = new EzeePMSService({ hotelCode: p.pmsConfig.hotelCode, authCode: p.pmsConfig.authCode });
  const mapping = await pms.getSeparateSourceMapping();
  console.log("Mapping Room Types:", mapping.roomTypes.length, "Rate Types:", mapping.rateTypes.length, "Plans:", mapping.ratePlans.length);
  console.log("Plans sample:", mapping.ratePlans.slice(0, 3));
  
  const rates = await pms.getRates("2026-04-10", "2026-04-12");
  console.log("Rates extracted:", rates.length);
  console.log("Rates sample:", rates.slice(0, 3));
  
  process.exit();
}
main();
