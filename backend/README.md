# Veil Shine Backend

This repository contains the backend services for the Veil Shine anonymous AI social platform.

## Technologies Used

*   Node.js
*   Express.js
*   MongoDB (via Mongoose)
*   AI Integration (for Moderation, NLP, Generative AI)

## Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm (Node Package Manager)
*   MongoDB (local instance or cloud service)

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd veil-shine-backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the root directory and add the following environment variables:
    ```
    PORT=3000
    MONGO_URI=mongodb://localhost:27017/veilshine
    AI_MODERATION_SERVICE_URL=http://localhost:5001/moderate
    AI_NLP_SERVICE_URL=http://localhost:5002/analyze
    AI_GENERATION_SERVICE_URL=http://localhost:5003/generate
    ```
    *Note: The AI service URLs are placeholders. You will need to set up and run these services separately or replace them with actual API endpoints.*

### Running the Application

*   **Development Mode (with nodemon):**
    ```bash
    npm run dev
    ```
*   **Production Mode:**
    ```bash
    npm start
    ```

The API will be running on `http://localhost:3000` (or the PORT specified in your `.env` file).

## API Endpoints (Examples)

*   `GET /` - Basic health check
*   `POST /api/posts` - Create a new anonymous post (integrates with AI moderation and sentiment analysis)
*   `GET /api/posts` - Retrieve all posts

## Folder Structure

```
backend/
├── app.js                 # Main application entry point
├── package.json           # Project dependencies and scripts
├── .env                   # Environment variables
├── README.md              # This file
├── src/
│   ├── controllers/       # Handles incoming requests and sends responses
│   │   └── postController.js
│   ├── services/          # Business logic and data manipulation
│   │   └── userService.js
│   ├── models/            # Mongoose schemas for database models
│   │   └── Post.js
│   ├── routes/            # Defines API endpoints
│   │   └── postRoutes.js
│   └── middleware/        # Custom middleware (e.g., AI integration, authentication)
│       └── aiIntegration.js
├── config/                # Configuration files (e.g., database connection)
├── utils/                 # Utility functions
├── tests/                 # Unit and integration tests
└── docs/                  # Backend-specific documentation
```

## AI Integration (Free APIs for Development)

For development purposes, you can simulate the AI services or use free/open-source alternatives. Here are some suggestions:

*   **Moderation AI:**
    *   **Local/Open Source:** Use a library like `profanity-check` (Python) or `bad-words` (Node.js) for basic keyword filtering. For more advanced moderation, consider open-source models like those from Hugging Face (e.g., `distilbert-base-uncased-finetuned-sst-2-english` for sentiment, which can be adapted for toxicity).
    *   **Free Tier Cloud APIs:** Explore free tiers of Google Cloud Natural Language API or AWS Comprehend for basic sentiment analysis and entity recognition, which can be part of a moderation pipeline.

*   **NLP Service (Sentiment Analysis, Entity Extraction):**
    *   **Local/Open Source:** `spaCy` (Python) or `compromise` (Node.js) for basic NLP tasks. Hugging Face models can also be deployed locally.
    *   **Free Tier Cloud APIs:** Google Cloud Natural Language API, AWS Comprehend.

*   **Generative AI Service:**
    *   **Local/Open Source:** Explore smaller open-source LLMs that can be run locally (e.g., via `ollama` or `llama.cpp`) for text generation. Models like `GPT-2` or `distilgpt2` can be used for basic generation tasks.
    *   **Free Tier Cloud APIs:** Some platforms offer free trial periods or limited free usage for their generative AI APIs (e.g., OpenAI API free trial, Google AI Studio for Gemini models with usage limits).

### Example Python Flask Microservices for AI (Simulated)

You can create simple Flask applications to simulate these AI services locally. Here's a basic example for a moderation service:

**`ai_services/moderation_service.py`**
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/moderate", methods=["POST"])
def moderate():
    data = request.json
    text = data.get("text", "")
    
    # Simple moderation logic (placeholder)
    if "hate speech" in text.lower() or "bad word" in text.lower():
        return jsonify({"status": "flagged", "reason": "Contains prohibited terms"})
    else:
        return jsonify({"status": "approved", "reason": "No issues found"})

if __name__ == "__main__":
    app.run(port=5001)
```

Similarly, you can create `nlp_service.py` (port 5002) and `generation_service.py` (port 5003) with placeholder logic. Remember to install `flask` (`pip install flask`) in a virtual environment for these services.

## Contributing

Contributions are welcome! Please refer to the `CONTRIBUTING.md` (to be created) for guidelines.

## License

This project is licensed under the MIT License - see the `LICENSE` (to be created) file for details.
