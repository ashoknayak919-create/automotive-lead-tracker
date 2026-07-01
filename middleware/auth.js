// middleware/auth.js
// Simple API key auth — add header: x-api-key: YOUR_KEY
const auth = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!process.env.API_SECRET_KEY || key === process.env.API_SECRET_KEY) {
    return next();
  }
  res.status(401).json({ success: false, error: "Unauthorized" });
};
module.exports = auth;
