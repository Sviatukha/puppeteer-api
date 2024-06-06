import express from 'express';
import { handler } from './launchBrowser.mjs';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

app.post('/', async (req, res) => {
  try {
    const { preset, fontsArr } = req.body;
    const content = await handler(preset, fontsArr);
    res.send(content);
  } catch (error) {
    console.error('Error launching browser:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port:${PORT}`);
});
