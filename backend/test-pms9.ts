import { connect } from 'mongoose';
import { PropertyModel } from './src/models/property';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { EzeePMSService } from './src/services/pms/adapters/EzeePMSService';

async function main() {
  await connect(process.env.MONGO_URI || "mongodb+srv://akash:Aky1234@cluster0.3irqq0z.mongodb.net/moustache_crm?retryWrites=true&w=majority&appName=Cluster0");
  const props = await PropertyModel.find().lean();
  const p = props.find(x => x.name.includes("Jaipur")) as any;
  
  if (!p) {
     console.log("No prop"); process.exit(1);
  }

  const pms = new EzeePMSService({ hotelCode: p.pmsConfig.hotelCode, authCode: p.pmsConfig.authCode });
  const mapping = await pms.getSeparateSourceMapping();
  
  console.log("TS-NODE IMPORT Stats:", {
    roomLength: mapping.roomTypes.length,
    rateTypeLength: mapping.rateTypes.length,
    ratePlanLength: mapping.ratePlans.length,
  });

  process.exit();
}
main();
