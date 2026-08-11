import app from "../backend/app.js";

export default function handler(req, res) {
  return app(req, res);
}
