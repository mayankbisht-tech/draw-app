import module = require("next/dist/server/route-modules/app-route/module");

import dotenv=require('dotenv');

dotenv.config();

const JWT_SECRET =  process.env.JWT_SECRET;
export { JWT_SECRET };