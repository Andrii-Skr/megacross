import express from "express";
import { getWordsAndDefinitions, getAllTags } from "./services/wordDefinitionService";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Allow CORS for the client application
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173"); // Assuming React app runs on 5173
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get("/api/words", async (req, res) => {
  const { wordText, definitionText, tags } = req.query;
  const tagNames = typeof tags === "string" ? tags.split(",") : undefined;

  try {
    const words = await getWordsAndDefinitions(
      wordText as string,
      definitionText as string,
      tagNames
    );
    res.json(words);
  } catch (error) {
    console.error("Error fetching words and definitions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/tags", async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json(tags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
