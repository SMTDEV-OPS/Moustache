import { connect } from 'mongoose';
import { EzeePMSService } from './src/services/pms/adapters/EzeePMSService';
import { PropertyModel } from './src/models/property';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function main() {
  await connect(process.env.MONGO_URI || "mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/moustache_crm?retryWrites=true&w=majority&appName=Cluster0");
  const props = await PropertyModel.find().lean();
  const p = props.find(x => x.name.includes("Jaipur")) as any;
  const pms = new EzeePMSService({ hotelCode: p.pmsConfig.hotelCode, authCode: p.pmsConfig.authCode });
  const mapping = await pms.getSeparateSourceMapping();
  console.log("RoomType Sample:", mapping.roomTypes[0]);
  console.log("RateType Sample:", mapping.rateTypes[0]);
  console.log("RatePlan Sample:", mapping.ratePlans[0]);
  process.exit();
}
main();
