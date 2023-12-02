const express = require('express');
const { ServerConfig } = require('./config');
// const { CRONS } = require('./utils/common');
const CRON = require('./utils/common/cron-jobs');

const app = express();
const apiRoutes = require('./routes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.listen(ServerConfig.PORT, () => {
  console.log(`Site is up and running on PORT No. ${ServerConfig.PORT}`);
  CRON();
});
