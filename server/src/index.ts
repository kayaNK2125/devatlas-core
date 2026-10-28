import { app } from './app';
import { config } from './config';

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 DevAtlas Core Backend running on port ${config.port}`);
  console.log(`🔒 Allowed Root Directory: ${config.allowedRoot}`);
  console.log(`📊 Mode: ${config.env}`);
  console.log(`=======================================================`);
});
