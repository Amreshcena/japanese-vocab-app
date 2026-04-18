require('dotenv').config();
const express   = require('express');
const fetch     = require('node-fetch');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();
app.use(express.json());

// Serve all static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter: max 30 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' }
});
app.use('/api/', apiLimiter);

// Gemini proxy — keeps your API key on the server, never exposed to browser
app.post('/api/gemini', async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
          })
        }
      );

      const data = await response.json();

      if (data.error?.code === 503) {
        if (attempt < MAX_RETRIES) {
          console.log(`503 error, retrying (${attempt}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
          continue;
        }
        return res.status(503).json({ error: 'Gemini is busy. Please try again in a moment.' });
      }

      if (data.error) {
        console.error('Gemini API error:', data.error);
        return res.status(500).json({ error: data.error.message });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.json({ text });

    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Server error: ' + err.message });
      }
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
});

// Fallback — serves index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ NihonMozhi running on port ${PORT}`);
});
