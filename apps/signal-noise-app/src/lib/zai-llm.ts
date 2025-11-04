// Helper function to get the appropriate model
export function getModel() {
  // Use OpenAI only - Z.AI removed to avoid confusion
  console.log("🔧 Using OpenAI gpt-4.1-mini-2025-04-14");
  const { openai } = require("@ai-sdk/openai");
  return openai("gpt-4.1-mini-2025-04-14");
}
