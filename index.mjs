import express from 'express';
import { handler } from './launchBrowser.mjs';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

app.post('/', async (req, res) => {
  const start = Date.now();
  console.log('started -------- 0');
  try {
    const { preset, fontsArr } = req.body;
    const content = await handler(preset, fontsArr, start);
    const end = Date.now();
    console.log(`Elapsed time: ${end - start}ms`);
    res.send(content);
  } catch (error) {
    console.error('Error launching browser:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port:${PORT}`);
});
