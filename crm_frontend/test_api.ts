import { listRoles } from "./src/services/roles";

listRoles().then(r => console.log(r)).catch(console.error);

