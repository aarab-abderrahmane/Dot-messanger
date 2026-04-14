require("dotenv").config();

async function getGifs (req, res)  {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 25)
    : 10;
  const apiKey = process.env.GIPHY_API_KEY;
  const query = req.query.q || 'funny';

  if (!apiKey) {
    return res.json([]);
  }

  try {
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      res.json(data.data);
    } else {
      res.json([]); 
    }

  } catch (error) {
    res.status(500).json({ error: "GIF ni olib bo'lmadi" });
  }
}

module.exports = {getGifs}
