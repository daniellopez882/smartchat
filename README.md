# SmartChat: A Personal AI Assistant

## Introduction

SmartChat is a multimodal AI assistant platform designed to provide a secure and powerful interface for interacting with various AI models. It consists of a full-stack local application built with Next.js and TypeScript, designed to keep your most important information securely on your local machine.

The platform leverages multiple AI models and supports both standard chat and enhanced chat with RAG (Retrieval-Augmented Generation) capabilities. When users ask questions related to uploaded data, the chatbot fetches and references relevant sections from stored PDF data to provide accurate and precise answers.

## Features

### Chat Platform Using Various AI Models

SmartChat allows you to select from a variety of Generative AI models:

1. **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, and GPT-4.
2. **Google**: Gemini 1.5 Flash, Gemini 1.5 Pro, and Gemini 2.0 models.
3. **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, and Claude 3 Opus.
4. **Groq**: Llama 3.2, Llama 3.1, Mixtral, and Gemma models.

### Multimodal Capabilities

Users can upload images or take desktop screenshots to ask questions about them, either standalone or combined with text input and RAG-fetched information.

### Local Privacy with SQLite

To ensure privacy, the app uses TypeORM with SQLite to store chat messages, assistant configurations, and other critical content locally.

### Retrieval Augmented Generation (RAG)

Upload PDF documents and customize how your data is processed. Extracted data is chunked, embedded, and securely stored in Pinecone for efficient retrieval.

### AI Model Finetuning

Refine AI models to meet your specific needs by uploading training data and selecting fine-tuning parameters for both OpenAI and open-source models.

## Getting Started

### Prerequisites

- **Node.js**: Install Node.js from the official website.
- **Yarn**: Install Yarn globally: `npm install --global yarn`

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/daniellopez882/smartchat.git
   cd smartchat
   ```

2. **Install Dependencies**:
   ```bash
   yarn install
   ```

3. **Configure Environment Variables**:
   Copy the `.env.example` file to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```
   Required keys: OpenAI, Google Gemini, Groq, Anthropic, Pinecone, etc.

4. **Database Setup**:
   The app uses a local SQLite database. Initialize it with:
   ```bash
   npx typeorm migration:run
   ```

### Running the App

1. **Build the Project**:
   ```bash
   yarn build
   ```

2. **Start the Application**:
   ```bash
   yarn start
   ```

Access the app at [http://localhost:3000](http://localhost:3000).

## Access on Mobile

The app is responsive. To access it on your mobile device:
1. Ensure your computer and phone are on the same network.
2. Find your computer's local IP address.
3. Access `http://<YOUR_IP>:3000` from your phone's browser.

For remote access, you can use tools like **ngrok** to create a secure tunnel to your local server.

## Development

To start the development server:
```bash
yarn dev
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any bugs, documentation improvements, or new features.

## License

This project is licensed under the Apache2.0 License - see the [LICENSE](LICENSE) file for details.

---
Author: **daniellopez882**
